from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.db import transaction
from .models import (
    Cliente, Negocio, Servico, User,
    Levantamento, MDO, Material, Servico_terceirizado, Orcamento, Ativ_prevista, Resumo_orcamento,
    OrdenServico, Workspace, normalize_workspace_data
)
from .serializers import (
    ClienteSerializer, NegocioSerializer, ServicoSerializer, UserSerializer,
    OrcamentoSerializer, LevantamentoSerializer, Resumo_orcamentoSerializer,
    MDOSerializer, MaterialSerializer, Ativ_previstaSerializer, ServicosTerceirizadosSerializer,
    OrdenServicoSerializer, WorkspaceSerializer
)
from django.http import FileResponse
from django.conf import settings
import os

# --- ViewSets Básicos ---
class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class ServicoViewSet(viewsets.ModelViewSet):
    queryset = Servico.objects.all()
    serializer_class = ServicoSerializer

class MDOViewSet(viewsets.ModelViewSet):
    queryset = MDO.objects.all()
    serializer_class = MDOSerializer

class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.all()
    serializer_class = MaterialSerializer

class AtividadeViewSet(viewsets.ModelViewSet):
    queryset = Ativ_prevista.objects.all()
    serializer_class = Ativ_previstaSerializer

class TerceirizadoViewSet(viewsets.ModelViewSet):
    queryset = Servico_terceirizado.objects.all()
    serializer_class = ServicosTerceirizadosSerializer

class LevantamentoViewSet(viewsets.ModelViewSet):
    queryset = Levantamento.objects.all()
    serializer_class = LevantamentoSerializer

class OrcamentoViewSet(viewsets.ModelViewSet):
    queryset = Orcamento.objects.all()   
    serializer_class = OrcamentoSerializer 

#NEGÓCIOS
# --- ViewSet de Negócio com Lógica Customizada ---
class NegocioViewSet(viewsets.ModelViewSet):
    queryset = Negocio.objects.select_related('cliente').prefetch_related('servicos').all()
    serializer_class = NegocioSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        servicos_data = request.data.pop('servicos', [])
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        negocio = serializer.save()

        servicos_objs = []
        for servico in servicos_data:
            servico['negocio'] = negocio.id
            s_serializer = ServicoSerializer(data=servico)
            s_serializer.is_valid(raise_exception=True)
            s_serializer.save()
            servicos_objs.append(s_serializer.data)

        return Response({"negocio": serializer.data, "servicos": servicos_objs}, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if 'servicos' in request.data:
            servicos_data = request.data.get('servicos')
            instance.servicos.all().delete()
            for servico in servicos_data:
                servico['negocio'] = instance.id
                s_serializer = ServicoSerializer(data=servico)
                s_serializer.is_valid(raise_exception=True)
                s_serializer.save()
        return Response(serializer.data)
    
#ORÇAMENTOS
# --- Funções Customizadas ---
@api_view(['GET'])
def visualizar_orcamento(request, filename):
    file_path = os.path.join(settings.MEDIA_ROOT, 'documentos_negocios', filename)
    if not os.path.exists(file_path):
        return Response({'error': 'Arquivo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    return FileResponse(open(file_path, 'rb'), content_type='application/pdf')

@api_view(['POST']) 
def criar_orcamento(request):
    with transaction.atomic():
        # 1. Levantamento
        lev_data = request.data.get('levantamento')
        negocio_id = lev_data.get('negocio')
        levantamento_instance = Levantamento.objects.filter(negocio_id=negocio_id).first()
        
        if not levantamento_instance:
            lev_serializer = LevantamentoSerializer(data=lev_data)
            lev_serializer.is_valid(raise_exception=True)
            levantamento_instance = lev_serializer.save()

        # 2. Resumo
        res_serializer = Resumo_orcamentoSerializer(data=request.data.get('resumo'))
        res_serializer.is_valid(raise_exception=True)
        resumo_instance = res_serializer.save()

        # 3. Orçamento Pai
        orcamento_instance = Orcamento.objects.create(
            levantamento=levantamento_instance,
            resumo=resumo_instance,
            Observacoes_setor_orcamento=request.data.get('observacoes', '')
        )
        
        # 4. Itens (Looping para salvar cada lista)
        for item in request.data.get('mao_de_obra', []):
            MDO.objects.create(orcamento=orcamento_instance, **item)
        for item in request.data.get('materiais', []):
            Material.objects.create(orcamento=orcamento_instance, **item)
        for item in request.data.get('terceirizados', []):
            Servico_terceirizado.objects.create(orcamento=orcamento_instance, **item)

        return Response({
            "message": "Orçamento completo criado com sucesso!",
            "orcamento_id": orcamento_instance.id
        }, status=status.HTTP_201_CREATED)


# --------------------- Ordem de Servico (OS) ---------------------

class OrdenServicoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar Ordens de Servico (OS)
    Operações: CREATE, READ, UPDATE, DELETE
    """
    queryset = OrdenServico.objects.select_related('cliente', 'negocio').all()
    serializer_class = OrdenServicoSerializer
    
    def list(self, request, *args, **kwargs):
        """
        Listar todas as OS com filtros opcionais
        Filtros: cliente_id, negocio_id, status_os, status_envio, status_aprovacao
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        # Filtros opcionais
        cliente_id = request.query_params.get('cliente')
        negocio_id = request.query_params.get('negocio')
        status_os = request.query_params.get('status_os')
        status_envio = request.query_params.get('status_envio')
        status_aprovacao = request.query_params.get('status_aprovacao')
        
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)
        if negocio_id:
            queryset = queryset.filter(negocio_id=negocio_id)
        if status_os:
            queryset = queryset.filter(status_os=status_os)
        if status_envio:
            queryset = queryset.filter(status_envio=status_envio)
        if status_aprovacao:
            queryset = queryset.filter(status_aprovacao=status_aprovacao)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Criar uma nova Ordem de Servico
        Campos obrigatórios: cliente, local, supervisor_encarregado, descricao_geral_servico
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        return Response(
            {
                "message": "Ordem de Servico criada com sucesso!",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )
    
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """
        Atualizar uma Ordem de Servico existente
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(
            {
                "message": "Ordem de Servico atualizada com sucesso!",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )
    
    def destroy(self, request, *args, **kwargs):
        """
        Deletar uma Ordem de Servico
        """
        instance = self.get_object()
        numero_os = instance.numero_os
        self.perform_destroy(instance)
        
        return Response(
            {"message": f"Ordem de Servico {numero_os} deletada com sucesso!"},
            status=status.HTTP_204_NO_CONTENT
        )


@api_view(['GET', 'POST', 'PUT', 'PATCH'])
@transaction.atomic
def workspace_data(request, admin_email):
    workspace, created = Workspace.objects.get_or_create(
        admin_email=admin_email,
        defaults={'data': normalize_workspace_data({})}
    )

    if request.method == 'GET':
        return Response(WorkspaceSerializer(workspace).data, status=status.HTTP_200_OK)

    payload = request.data
    if isinstance(payload, dict) and set(payload.keys()) == {'data'}:
        payload = payload.get('data')

    serializer = WorkspaceSerializer(
        workspace,
        data={
            'admin_email': admin_email,
            'data': normalize_workspace_data(payload if isinstance(payload, dict) else {}),
        },
        partial=request.method == 'PATCH'
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response(serializer.data, status=status.HTTP_201_CREATED if created and request.method == 'POST' else status.HTTP_200_OK)


@api_view(['GET'])
def ordens_servico_por_cliente(request, cliente_id):
    """
    Endpoint customizado para buscar todas as OS de um cliente específico
    GET /api/os-por-cliente/<cliente_id>/
    """
    try:
        cliente = Cliente.objects.get(id=cliente_id)
        ordens_servico = OrdenServico.objects.filter(cliente=cliente).order_by('-created_at')
        
        serializer = OrdenServicoSerializer(ordens_servico, many=True)
        return Response(
            {
                "cliente": ClienteSerializer(cliente).data,
                "ordens_servico": serializer.data,
                "total": ordens_servico.count()
            },
            status=status.HTTP_200_OK
        )
    except Cliente.DoesNotExist:
        return Response(
            {"error": "Cliente não encontrado"},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def ordens_servico_por_negocio(request, negocio_id):
    """
    Endpoint customizado para buscar todas as OS de um negócio específico
    GET /api/os-por-negocio/<negocio_id>/
    """
    try:
        negocio = Negocio.objects.get(id=negocio_id)
        ordens_servico = OrdenServico.objects.filter(negocio=negocio).order_by('-created_at')
        
        serializer = OrdenServicoSerializer(ordens_servico, many=True)
        return Response(
            {
                "negocio": NegocioSerializer(negocio).data,
                "ordens_servico": serializer.data,
                "total": ordens_servico.count()
            },
            status=status.HTTP_200_OK
        )
    except Negocio.DoesNotExist:
        return Response(
            {"error": "Negócio não encontrado"},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['PATCH'])
def atualizar_status_os(request, pk):
    """
    Endpoint para atualizar apenas o status de uma OS
    PATCH /api/os/<id>/atualizar-status/
    Payload: {
        "status_os": "emproducao" | "concluida",
        "status_envio": "pendente" | "enviada",
        "status_aprovacao": "pendente" | "aprovada"
    }
    """
    try:
        ordem_servico = OrdenServico.objects.get(id=pk)
        
        # Atualizar status se fornecido
        if 'status_os' in request.data:
            ordem_servico.status_os = request.data['status_os']
        if 'status_envio' in request.data:
            ordem_servico.status_envio = request.data['status_envio']
        if 'status_aprovacao' in request.data:
            ordem_servico.status_aprovacao = request.data['status_aprovacao']
            if request.data['status_aprovacao'] == 'aprovada':
                from django.utils import timezone
                ordem_servico.data_aprovacao = timezone.now().date()
        
        ordem_servico.save()
        
        serializer = OrdenServicoSerializer(ordem_servico)
        return Response(
            {
                "message": "Status da OS atualizado com sucesso!",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )
    except OrdenServico.DoesNotExist:
        return Response(
            {"error": "Ordem de Servico não encontrada"},
            status=status.HTTP_404_NOT_FOUND
        )

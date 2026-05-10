from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.db import transaction
from .models import (
    Cliente, Negocio, Servico, User,
    Levantamento, MDO, Material, Servico_terceirizado, Orcamento
)
from .serializers import (
    ClienteSerializer, NegocioSerializer, ServicoSerializer, UserSerializer,
    OrcamentoSerializer, LevantamentoSerializer, Resumo_orcamentoSerializer
)
from django.http import FileResponse
from django.conf import settings
import os

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class ServicoViewSet(viewsets.ModelViewSet):
    queryset = Servico.objects.all()
    serializer_class = ServicoSerializer

class NegocioViewSet(viewsets.ModelViewSet):
    # O select_related faz um JOIN no SQL para o Cliente
    # O prefetch_related traz os serviços de forma otimizada e evita sobrecargas de consultas ao BD
    queryset = Negocio.objects.select_related('cliente').prefetch_related('servicos').all()
    serializer_class = NegocioSerializer

#Método customizado para criar Negócio e Serviços juntos, garantindo a integridade dos dados com transações atômicas
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # Extrai os serviços do corpo da requisição
        servicos_data = request.data.pop('servicos', [])
        
        # 1. Cria o Negócio primeiro
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        negocio = serializer.save()

        # 2. Cria os Serviços vinculados a esse Negócio
        servicos_objs = []
        for servico in servicos_data:
            servico['negocio'] = negocio.id
            s_serializer = ServicoSerializer(data=servico)
            s_serializer.is_valid(raise_exception=True)
            s_serializer.save()
            servicos_objs.append(s_serializer.data)

        headers = self.get_success_headers(serializer.data)
        return Response({
            "negocio": serializer.data,
            "servicos": servicos_objs
        }, status=status.HTTP_201_CREATED, headers=headers)
    

    # O método PUT (update) para Negócio e serviços
    #Usar path: /api/negocios/{id}/ para atualizar um negócio específico, enviando o JSON com os dados do negócio e a lista de serviços atualizada.

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        # 1. Atualiza os dados básicos do Negócio
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # 2. Lógica opcional para serviços (se vierem no JSON)
        if 'servicos' in request.data:
            servicos_data = request.data.get('servicos')
            # Opção simples: deleta os antigos e cadastra os novos (reset da lista)
            instance.servicos.all().delete()
            for servico in servicos_data:
                servico['negocio'] = instance.id
                s_serializer = ServicoSerializer(data=servico)
                s_serializer.is_valid(raise_exception=True)
                s_serializer.save()

        return Response(serializer.data)

@api_view(['GET'])
def visualizar_orcamento(request, filename):
    # Caminho completo do arquivo
    file_path = os.path.join(settings.MEDIA_ROOT, 'documentos_negocios', filename)

    # Verifica se o arquivo existe
    if not os.path.exists(file_path):
        return Response({'error': 'Arquivo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    # Retorna o arquivo como resposta
    return FileResponse(open(file_path, 'rb'), content_type='application/pdf')

# ...ação: criar uma entrada orçamento...

class OrcamentoViewSet(viewsets.ModelViewSet):
    queryset = Orcamento.objects.all()   
    serializer_class = OrcamentoSerializer 

@api_view(['POST'])
def criar_orcamento(request):
    """
    Expects JSON:
    {
        "levantamento": { "negocio": <id>, "cliente": <id> },
        "resumo": { ... },
        "observacoes": "Texto opcional"
    }
    Note: A Negocio can only have ONE Levantamento (OneToOne relationship).
    """
    with transaction.atomic():
        # 1. Handle Levantamento
        lev_data = request.data.get('levantamento')
        lev_serializer = LevantamentoSerializer(data=lev_data)
        if not lev_serializer.is_valid():
            return Response({"error": "Levantamento inválido", "details": lev_serializer.errors}, status=400)
        
        # Check if Levantamento already exists for this Negocio (OneToOne constraint)
        negocio_id = lev_data.get('negocio')
        if Levantamento.objects.filter(negocio_id=negocio_id).exists():
            return Response({
                "error": "Levantamento já existe para este Negócio",
                "details": "Cada Negócio pode ter apenas um Levantamento. Atualize o Levantamento existente em vez de criar um novo."
            }, status=400)
        
        try:
            levantamento_instance = lev_serializer.save()
        except Exception as e:
            return Response({
                "error": "Erro ao criar Levantamento",
                "details": str(e)
            }, status=400)

        # 2. Handle Resumo
        resumo_data = request.data.get('resumo')
        res_serializer = Resumo_orcamentoSerializer(data=resumo_data)
        if not res_serializer.is_valid():
            # Rollback triggered automatically by transaction.atomic()
            return Response({"error": "Resumo inválido", "details": res_serializer.errors}, status=400)
        resumo_instance = res_serializer.save()

        # 3. Create the Parent 'Orcamento' to join them
        orcamento_instance = Orcamento.objects.create(
            levantamento=levantamento_instance,
            resumo=resumo_instance,
            Observacoes_setor_orcamento=request.data.get('observacoes', '')
        )
        
        # Save MDO (Mão de Obra)
        mdo_data = request.data.get('mao_de_obra', [])
        for item in mdo_data:
            MDO.objects.create(orcamento=orcamento_instance, **item)
            
        # Save Materials
        materiais_data = request.data.get('materiais', [])
        for item in materiais_data:
            Material.objects.create(orcamento=orcamento_instance, **item)
            
        # Save Outsource Services
        terceirizados_data = request.data.get('terceirizados', [])
        for item in terceirizados_data:
            Servico_terceirizado.objects.create(orcamento=orcamento_instance, **item)

        # 4. Return combined data (Now including property totals!)
        return Response({
            "message": "Orçamento completo criado com sucesso!",
            "orcamento_id": orcamento_instance.id,
            "custo_total": str(resumo_instance.custo_com_impostos),
            # The properties now work because the items above were just saved!
        }, status=status.HTTP_201_CREATED)
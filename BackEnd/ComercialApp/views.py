from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.db import transaction
from .models import (
    Cliente, Negocio, Servico, User,
    Levantamento, MDO, Material, Servico_terceirizado, Orcamento, Ativ_prevista, Resumo_orcamento
)
from .serializers import (
    ClienteSerializer, NegocioSerializer, ServicoSerializer, UserSerializer,
    OrcamentoSerializer, LevantamentoSerializer, Resumo_orcamentoSerializer,
    MDOSerializer, MaterialSerializer, Ativ_previstaSerializer, ServicosTerceirizadosSerializer
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
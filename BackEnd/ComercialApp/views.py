from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.db import transaction
from .models import Cliente, Negocio, Servico, User
from .serializers import ClienteSerializer, NegocioSerializer, ServicoSerializer, UserSerializer

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
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NegocioViewSet, OrcamentoViewSet,
    cadastrar_negocio_completo, criar_orcamento
)

# Optional: Add basic ViewSets for other models if needed
from rest_framework import viewsets
from .models import Cliente, Servico, User, Levantamento
from .serializers import ClienteSerializer, ServicoSerializer, UserSerializer, LevantamentoSerializer

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

class ServicoViewSet(viewsets.ModelViewSet):
    queryset = Servico.objects.all()
    serializer_class = ServicoSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class LevantamentoViewSet(viewsets.ModelViewSet):
    queryset = Levantamento.objects.all()
    serializer_class = LevantamentoSerializer

# Router registration
router = DefaultRouter()
router.register(r'clientes', ClienteViewSet)
router.register(r'negocios', NegocioViewSet)
router.register(r'servicos', ServicoViewSet)
router.register(r'usuarios', UserViewSet)
router.register(r'levantamentos', LevantamentoViewSet)
router.register(r'orcamentos', OrcamentoViewSet)

urlpatterns = [
    # Router-based CRUD endpoints
    path('', include(router.urls)),
    
    # Custom composite endpoints
    path('negocios/completo/', cadastrar_negocio_completo, name='cadastrar-negocio-completo'),
    path('orcamentos/criar/', criar_orcamento, name='criar-orcamento'),
]
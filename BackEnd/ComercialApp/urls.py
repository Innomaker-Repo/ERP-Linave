# ComercialApp/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, NegocioViewSet, ServicoViewSet

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet)
router.register(r'negocios', NegocioViewSet)
router.register(r'servicos', ServicoViewSet)

urlpatterns = [
    path('', include(router.urls)), # Deixe o path vazio aqui
]
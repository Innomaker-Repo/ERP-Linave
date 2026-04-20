from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, NegocioViewSet, ServicoViewSet, UserViewSet

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet)
router.register(r'negocios', NegocioViewSet)
router.register(r'servicos', ServicoViewSet)
router.register(r'usuarios', UserViewSet)

urlpatterns = [
    path('', include(router.urls)),
   
]
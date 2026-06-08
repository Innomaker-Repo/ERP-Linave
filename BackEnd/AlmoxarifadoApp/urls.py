from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TabelaEstoqueViewSet,
    ItemEstoqueViewSet,
    TipoGasViewSet,
    AlocacaoGasViewSet,
    HistoricoBaixaViewSet,
    HistoricoAlocacaoViewSet,
    estoque_completo,
)

router = DefaultRouter()
router.register(r'tabelas', TabelaEstoqueViewSet, basename='tabela-estoque')
router.register(r'itens', ItemEstoqueViewSet, basename='item-estoque')
router.register(r'tipos-gas', TipoGasViewSet, basename='tipo-gas')
router.register(r'alocacoes-gas', AlocacaoGasViewSet, basename='alocacao-gas')
router.register(r'historico-baixas', HistoricoBaixaViewSet, basename='historico-baixa')
router.register(r'historico-alocacoes', HistoricoAlocacaoViewSet, basename='historico-alocacao')

urlpatterns = [
    path('estoque-completo/', estoque_completo, name='estoque-completo'),
    path('', include(router.urls)),
]

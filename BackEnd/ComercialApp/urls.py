from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NegocioViewSet, OrcamentoViewSet, ClienteViewSet, ServicoViewSet, 
    UserViewSet, LevantamentoViewSet, MDOViewSet, MaterialViewSet,
    AtividadeViewSet, TerceirizadoViewSet, OrdenServicoViewSet,
    criar_orcamento, visualizar_orcamento,
    ordens_servico_por_cliente, ordens_servico_por_negocio, atualizar_status_os,
    workspace_data
)

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet)
router.register(r'negocios', NegocioViewSet)
router.register(r'servicos', ServicoViewSet)
router.register(r'usuarios', UserViewSet)
router.register(r'levantamentos', LevantamentoViewSet)
router.register(r'orcamentos', OrcamentoViewSet)
router.register(r'mdo', MDOViewSet)
router.register(r'materiais', MaterialViewSet)
router.register(r'atividades', AtividadeViewSet)
router.register(r'terceirizados', TerceirizadoViewSet)
router.register(r'ordens-servico', OrdenServicoViewSet, basename='ordem-servico')

urlpatterns = [
    path('workspaces/<str:admin_email>/', workspace_data, name='workspace-data'),

    # 1. Rota criação de orçamento
    path('orcamentos/criar/', criar_orcamento, name='criar-orcamento'),

    # 2. Rota visualização de PDF
    path('visualizar/<str:filename>/', visualizar_orcamento, name='visualizar-pdf'),

    # 3. Restante das rotas do router
    path('', include(router.urls)),
]
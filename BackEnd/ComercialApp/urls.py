from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NegocioViewSet, OrcamentoViewSet, ClienteViewSet, ServicoViewSet, 
    UserViewSet, LevantamentoViewSet, MDOViewSet, MaterialViewSet,
    AtividadeViewSet, TerceirizadoViewSet, OrdenServicoViewSet,
    PropostaComercialViewSet,
    criar_orcamento, visualizar_orcamento,
    ordens_servico_por_cliente, ordens_servico_por_negocio, atualizar_status_os,
    workspace_data
)

# Configuração do Router para ViewSets (Rotas automáticas)
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
router.register(r'propostas-comerciais', PropostaComercialViewSet, basename='proposta-comercial')

urlpatterns = [
    # Rota de Dados do Workspace (Sincronização Global)
    path('workspaces/<str:admin_email>/', workspace_data, name='workspace-data'),

    # 1. Rotas de Orçamento
    path('orcamentos/criar/', criar_orcamento, name='criar-orcamento'),
    path('visualizar/<str:filename>/', visualizar_orcamento, name='visualizar-pdf'),
    path('os-por-cliente/<int:cliente_id>/', ordens_servico_por_cliente, name='os-por-cliente'),
    path('os-por-negocio/<int:negocio_id>/', ordens_servico_por_negocio, name='os-por-negocio'),
    path('ordens-servico/<int:pk>/atualizar-status/', atualizar_status_os, name='atualizar-status-os'),

    # 2. Rotas de Filtro de Ordens de Serviço (Necessárias para o React)
    path('os-por-cliente/<int:cliente_id>/', ordens_servico_por_cliente, name='os-por-cliente'),
    path('os-por-negocio/<int:negocio_id>/', ordens_servico_por_negocio, name='os-por-negocio'),
    path('ordens-servico/<int:pk>/atualizar-status/', atualizar_status_os, name='atualizar-status-os'),

    # 3. Inclusão das rotas automáticas do Router
    path('', include(router.urls)),
]
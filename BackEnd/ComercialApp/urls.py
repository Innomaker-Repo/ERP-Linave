from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NegocioViewSet, ClienteViewSet, OrdemServicoViewSet,
    PropostaComercialViewSet, TemplatePropostaViewSet, FornecedorViewSet, MedicaoViewSet,
    DocumentoViewSet, UserViewSet, usuario_me,
    criar_orcamento, renomear_empresa_prestadora, renomear_cliente,
    ordens_servico_por_cliente, ordens_servico_por_negocio, atualizar_status_os,
    atualizar_status_medicao,
    financeiro_data, financeiro_solicitacao_criar, compras_data, almoxarifado_data, configuracoes_data,
    logs_atividade,
)

# Configuração do Router para ViewSets (Rotas automáticas)
router = DefaultRouter()
router.register(r'clientes', ClienteViewSet)
router.register(r'fornecedores', FornecedorViewSet)
router.register(r'negocios', NegocioViewSet)
router.register(r'ordens-servico', OrdemServicoViewSet, basename='ordem-servico')
router.register(r'propostas-comerciais', PropostaComercialViewSet, basename='proposta-comercial')
router.register(r'templates-proposta', TemplatePropostaViewSet, basename='template-proposta')
router.register(r'medicoes', MedicaoViewSet, basename='medicao')
router.register(r'documentos', DocumentoViewSet, basename='documento')
router.register(r'usuarios', UserViewSet, basename='usuario')

urlpatterns = [
    # Estado financeiro (lista unificada de FinRecord; GET lê, POST substitui tudo)
    path('financeiro/', financeiro_data, name='financeiro-data'),

    # Solicitação de pagamento (append-only; aberta a todo autenticado — ver docstring)
    path('financeiro/solicitacao/', financeiro_solicitacao_criar, name='financeiro-solicitacao-criar'),

    # Estado de compras (requisições do kanban + histórico; GET lê, POST substitui)
    path('compras/', compras_data, name='compras-data'),

    # Estado do estoque/almoxarifado (objeto agregado; GET lê, POST substitui)
    path('almoxarifado/', almoxarifado_data, name='almoxarifado-data'),

    # Configurações da empresa + listas auxiliares (GET lê, POST substitui)
    path('configuracoes/', configuracoes_data, name='configuracoes-data'),

    # Criação de orçamento (cria Levantamento/Orcamento/itens/Resumo numa transação)
    path('orcamentos/criar/', criar_orcamento, name='criar-orcamento'),

    # Renomeia empresa prestadora em cascata (negócios + medições já criados)
    path('empresas-prestadoras/renomear/', renomear_empresa_prestadora, name='renomear-empresa-prestadora'),

    # Renomeia cliente em cascata (medições já criadas — o resto referencia por FK)
    path('clientes/renomear/', renomear_cliente, name='renomear-cliente'),

    # Filtros de Ordens de Serviço
    path('os-por-cliente/<int:cliente_id>/', ordens_servico_por_cliente, name='os-por-cliente'),
    path('os-por-negocio/<int:negocio_id>/', ordens_servico_por_negocio, name='os-por-negocio'),
    path('ordens-servico/<int:pk>/atualizar-status/', atualizar_status_os, name='atualizar-status-os'),
    path('medicoes/<int:pk>/atualizar-status/', atualizar_status_medicao, name='atualizar-status-medicao'),

    # Usuário autenticado atual
    path('usuarios/me/', usuario_me, name='usuario-me'),

    # Log de atividades (admin only)
    path('logs/', logs_atividade, name='logs-atividade'),

    # Rotas automáticas do Router (sempre no final)
    path('', include(router.urls)),
]

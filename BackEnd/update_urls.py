#!/usr/bin/env python
"""
Script para atualizar o arquivo urls.py com rotas de OS
"""

import re

with open('ComercialApp/urls.py', 'r') as f:
    content = f.read()

# Atualizar imports
old_imports = '''from .views import (
    NegocioViewSet, OrcamentoViewSet, ClienteViewSet, ServicoViewSet, 
    UserViewSet, LevantamentoViewSet, MDOViewSet, MaterialViewSet,
    AtividadeViewSet, TerceirizadoViewSet,
    criar_orcamento, visualizar_orcamento
)'''

new_imports = '''from .views import (
    NegocioViewSet, OrcamentoViewSet, ClienteViewSet, ServicoViewSet, 
    UserViewSet, LevantamentoViewSet, MDOViewSet, MaterialViewSet,
    AtividadeViewSet, TerceirizadoViewSet, OrdenServiçoViewSet,
    criar_orcamento, visualizar_orcamento,
    ordens_servico_por_cliente, ordens_servico_por_negocio, atualizar_status_os
)'''

content = content.replace(old_imports, new_imports)

# Adicionar registro do router para OS
old_registration = '''router.register(r'terceirizados', TerceirizadoViewSet)

urlpatterns = ['''

new_registration = '''router.register(r'terceirizados', TerceirizadoViewSet)
router.register(r'ordens-servico', OrdenServiçoViewSet, basename='ordem-servico')

urlpatterns = ['''

content = content.replace(old_registration, new_registration)

# Atualizar urlpatterns
old_patterns = '''urlpatterns = [
    # 1. Rota criação de orçamento
    path('orcamentos/criar/', criar_orcamento, name='criar-orcamento'),

    # 2. Rota visualização de PDF
    path('visualizar/<str:filename>/', visualizar_orcamento, name='visualizar-pdf'),

    # 3. Restante das rotas do router
    path('', include(router.urls)),
]'''

new_patterns = '''urlpatterns = [
    # Orçamentos
    path('orcamentos/criar/', criar_orcamento, name='criar-orcamento'),
    path('visualizar/<str:filename>/', visualizar_orcamento, name='visualizar-pdf'),
    
    # Ordens de Serviço - Endpoints customizados
    path('os-por-cliente/<int:cliente_id>/', ordens_servico_por_cliente, name='os-por-cliente'),
    path('os-por-negocio/<int:negocio_id>/', ordens_servico_por_negocio, name='os-por-negocio'),
    path('ordens-servico/<int:pk>/atualizar-status/', atualizar_status_os, name='atualizar-status-os'),
    
    # Restante das rotas do router
    path('', include(router.urls)),
]'''

content = content.replace(old_patterns, new_patterns)

with open('ComercialApp/urls.py', 'w') as f:
    f.write(content)

print('URLs de OS adicionadas com sucesso!')

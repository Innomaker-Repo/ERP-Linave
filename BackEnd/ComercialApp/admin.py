from django.contrib import admin

from .models import Cliente, Negocio, Servico, User
from .models import Levantamento, MDO, Ativ_previstas, Materiais, Servicos_terceirizados, Observacoes_setor_orcamento, Resumo_orcamento

# Register your models here.

# Core

admin.site.register(Cliente)
admin.site.register(Negocio)
admin.site.register(Servico)
admin.site.register(User)

# Orcamento

admin.site.register(Levantamento)
admin.site.register(MDO)
admin.site.register(Ativ_previstas)
admin.site.register(Materiais)
admin.site.register(Servicos_terceirizados)
admin.site.register(Observacoes_setor_orcamento)
admin.site.register(Resumo_orcamento)

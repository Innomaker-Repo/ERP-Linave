from django.contrib import admin

from .models import Cliente, Negocio, Servico, User
from .models import Levantamento, MDO, Ativ_prevista, Material, Servico_terceirizado, Resumo_orcamento, Orcamento

# Register your models here.

# Core

admin.site.register(Cliente)
admin.site.register(Negocio)
admin.site.register(Servico)
admin.site.register(User)

# Orcamento

admin.site.register(Levantamento)
admin.site.register(MDO)
admin.site.register(Ativ_prevista)
admin.site.register(Material)
admin.site.register(Servico_terceirizado)
admin.site.register(Resumo_orcamento)
admin.site.register(Orcamento)

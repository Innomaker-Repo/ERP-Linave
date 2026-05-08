from django.contrib import admin
from .models import (
    Cliente, Negocio, Servico, User,
    Levantamento, MDO, Ativ_prevista, Material, 
    Servico_terceirizado, Resumo_orcamento, Orcamento
)

# 1. Define the Child Tables (The "N" items)
class MDOInline(admin.TabularInline):
    model = MDO
    extra = 1

class MaterialInline(admin.TabularInline):
    model = Material
    extra = 1

class ServicoTerceirizadoInline(admin.TabularInline):
    model = Servico_terceirizado
    extra = 1

class AtivPrevistaInline(admin.TabularInline):
    model = Ativ_prevista
    extra = 1

# 2. Define the Parent Admin
@admin.register(Orcamento)
class OrcamentoAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_cliente', 'get_total_final')
    # This is the "Magic" that puts the lists inside the Budget page
    inlines = [AtivPrevistaInline, MDOInline, MaterialInline, ServicoTerceirizadoInline]

    def get_cliente(self, obj):
        return obj.levantamento.cliente.razao_social
    get_cliente.short_description = 'Cliente'

    def get_total_final(self, obj):
        # This reaches into your property logic!
        return f"R$ {obj.resumo.custo_com_impostos}"
    get_total_final.short_description = 'Custo Com Impostos'

# 3. Read-Only display for the Summary
@admin.register(Resumo_orcamento)
class ResumoOrcamentoAdmin(admin.ModelAdmin):
    # These properties are not in the DB, so we must tell Admin they are Read Only
    readonly_fields = (
        'total_mdo', 'total_material', 'total_serv_terceirizado', 
        'custo_bruto', 'custo_com_impostos', 'custo_por_unidade'
    )

# 4. Standard Registries for the rest
admin.site.register(Cliente)
admin.site.register(Negocio)
admin.site.register(Servico)
admin.site.register(User)
admin.site.register(Levantamento)
from django.contrib import admin

from .models import Cliente, Negocio, Servico, User

# Register your models here.

admin.site.register(Cliente)
admin.site.register(Negocio)
admin.site.register(Servico)
admin.site.register(User)

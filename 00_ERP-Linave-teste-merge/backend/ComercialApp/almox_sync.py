"""Persistência do agregado de Estoque/Almoxarifado (objeto único do frontend)
numa linha singleton da tabela EstoqueAlmoxarifado.

O objeto completo é guardado em `data` (round-trip fiel para a UI); algumas listas
são projetadas em colunas para consulta SQL.
"""
from django.db import transaction

from .models import EstoqueAlmoxarifado


def _list(v):
    return v if isinstance(v, list) else []


def read():
    """Retorna o objeto de almoxarifado guardado, ou None se ainda não houver."""
    inst = EstoqueAlmoxarifado.objects.first()
    if not inst or not isinstance(inst.data, dict) or not inst.data:
        return None
    return inst.data


@transaction.atomic
def replace(obj):
    """Substitui o agregado (singleton) pelo objeto informado."""
    if not isinstance(obj, dict):
        obj = {}
    EstoqueAlmoxarifado.objects.all().delete()
    EstoqueAlmoxarifado.objects.create(
        data=obj,
        version=int(obj.get('version') or 2),
        tables=_list(obj.get('tables')),
        gas_types=_list(obj.get('gasTypes')),
        allocations=_list(obj.get('allocations')),
    )
    return read()

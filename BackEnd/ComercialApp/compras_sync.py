"""Ponte entre as requisições de compra do frontend (comprasLocal.ts) e as tabelas
relacionais RequisicaoCompra / CompraHistorico.

Mesmo princípio do Financeiro: o registro completo (com `itens` e `budgetDetails`
aninhados) é guardado em `extra` para round-trip fiel da UI; as colunas de topo são
preenchidas best-effort para consultas SQL.
"""
from decimal import Decimal, InvalidOperation

from django.db import transaction

from .models import RequisicaoCompra, CompraHistorico


def _dec_or_none(v):
    if v in (None, ''):
        return None
    try:
        return Decimal(str(v).replace(',', '.'))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _str(v):
    return '' if v is None else str(v)


def _req_instance(record):
    rid = _str(record.get('id')).strip()
    if not rid:
        return None
    return RequisicaoCompra(
        record_id=rid,
        solicitante=_str(record.get('solicitante'))[:150],
        departamento=_str(record.get('departamento'))[:150],
        centro_custo=_str(record.get('centroCusto'))[:120],
        stage=_str(record.get('stage'))[:40],
        approval_route=(_str(record.get('approvalRoute'))[:40] or None),
        purchase_state=_str(record.get('purchaseState'))[:30],
        budget_value=_dec_or_none(record.get('budgetValue')),
        extra=record,
    )


def _hist_instance(record):
    rid = _str(record.get('id')).strip()
    if not rid:
        return None
    return CompraHistorico(
        record_id=rid,
        solicitante=_str(record.get('solicitante'))[:150],
        departamento=_str(record.get('departamento'))[:150],
        centro_custo=_str(record.get('centroCusto'))[:120],
        finalizado_em=_str(record.get('finalizadoEm'))[:40],
        finalizado_por=_str(record.get('finalizadoPor'))[:150],
        budget_value=_dec_or_none(record.get('budgetValue')),
        extra=record,
    )


def _replace(model, builder, records):
    model.objects.all().delete()
    seen = set()
    instances = []
    for record in records or []:
        if not isinstance(record, dict):
            continue
        rid = _str(record.get('id')).strip()
        if not rid or rid in seen:
            continue
        inst = builder(record)
        if inst is None:
            continue
        seen.add(rid)
        instances.append(inst)
    model.objects.bulk_create(instances)
    return len(instances)


@transaction.atomic
def replace_requisicoes(records):
    return _replace(RequisicaoCompra, _req_instance, records)


@transaction.atomic
def replace_historico(records):
    return _replace(CompraHistorico, _hist_instance, records)


def _to_record(inst):
    return dict(inst.extra) if isinstance(inst.extra, dict) else {}


def read_requisicoes():
    return [_to_record(x) for x in RequisicaoCompra.objects.all()]


def read_historico():
    return [_to_record(x) for x in CompraHistorico.objects.all().order_by('-created_at')]

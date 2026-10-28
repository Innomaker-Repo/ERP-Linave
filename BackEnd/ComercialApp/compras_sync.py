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


# --- Escopo por dono (usuário comum só enxerga/altera as próprias compras) ------------

class ComprasSemPermissao(Exception):
    """Payload tenta criar/alterar/apagar compra de outra pessoa."""


def _norm(v):
    return _str(v).strip().lower()


def _canon(record):
    import json
    return json.dumps(record, sort_keys=True, default=str)


def pertence_ao_usuario(record, user):
    """O registro (requisição ou histórico) é do `user`?

    Mesma identidade do `matchesSolicitante` do frontend (comprasLocal.ts), só que
    mais estrita: quando o registro tem CPF, vale SÓ o CPF (é a PK, imutável — o e-mail
    o próprio usuário pode trocar no "Meu Perfil"). Sem CPF cai pro e-mail e, para
    dados antigos sem nenhum dos dois, pro nome digitado.
    """
    if not isinstance(record, dict):
        return False
    cpf_registro = _norm(record.get('solicitanteCpf'))
    if cpf_registro:
        return cpf_registro == _norm(getattr(user, 'cpf', ''))
    email_registro = _norm(record.get('solicitanteEmail'))
    if email_registro:
        return email_registro == _norm(getattr(user, 'email', ''))
    nome_registro = _norm(record.get('solicitante'))
    if not nome_registro:
        return False
    return nome_registro in {_norm(getattr(user, 'nome', '')), _norm(getattr(user, 'email', ''))} - {''}


def _sem_identidade(record):
    return not any(_norm(record.get(k)) for k in ('solicitanteCpf', 'solicitanteEmail', 'solicitante'))


def read_requisicoes_do_usuario(user):
    return [r for r in read_requisicoes() if pertence_ao_usuario(r, user)]


def read_historico_do_usuario(user):
    return [r for r in read_historico() if pertence_ao_usuario(r, user)]


def contar_do_usuario(model, user):
    return sum(1 for x in model.objects.all() if pertence_ao_usuario(_to_record(x), user))


def _replace_do_usuario(model, builder, records, user):
    """Replace-all restrito às compras do `user`: as dele que não vierem no payload são
    apagadas, as de outras pessoas ficam intocadas. Recusa (ComprasSemPermissao) qualquer
    registro do payload que seja de outra pessoa — inclusive um id já existente de outra
    pessoa reenviado com o CPF do usuário, que seria um jeito de "tomar" a compra alheia.
    Registro sem nenhuma identidade (nem CPF, nem e-mail, nem nome) é carimbado como dele.
    """
    existentes = {x.record_id: x for x in model.objects.select_for_update()}
    proprios = {rid for rid, x in existentes.items() if pertence_ao_usuario(_to_record(x), user)}

    validos = []
    for record in records or []:
        if not isinstance(record, dict):
            continue
        rid = _str(record.get('id')).strip()
        if not rid:
            continue
        if rid in existentes and rid not in proprios:
            # Quem LÊ tudo mas só grava as próprias (ex.: Custo por OS) reenvia a lista
            # inteira: registro alheio é aceito só se voltar idêntico — e aí fica como está.
            if _canon(record) == _canon(_to_record(existentes[rid])):
                continue
            raise ComprasSemPermissao(rid)
        if _sem_identidade(record):
            record = {**record, 'solicitanteCpf': _str(getattr(user, 'cpf', '')),
                      'solicitante': _str(getattr(user, 'nome', ''))}
        elif not pertence_ao_usuario(record, user):
            raise ComprasSemPermissao(rid)
        validos.append(record)

    model.objects.filter(record_id__in=proprios).delete()
    seen = set()
    instances = []
    for record in validos:
        rid = _str(record.get('id')).strip()
        if rid in seen:
            continue
        seen.add(rid)
        instances.append(builder(record))
    model.objects.bulk_create(instances)
    return len(instances)


@transaction.atomic
def replace_requisicoes_do_usuario(records, user):
    return _replace_do_usuario(RequisicaoCompra, _req_instance, records, user)


@transaction.atomic
def replace_historico_do_usuario(records, user):
    return _replace_do_usuario(CompraHistorico, _hist_instance, records, user)

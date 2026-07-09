"""Ponte entre os "FinRecord" do frontend (useFin.ts/finData.ts) e as tabelas
relacionais do Financeiro.

Princípio de segurança: o registro completo do frontend é guardado em `extra`
(garante round-trip perfeito para a UI, sem perda de campo), e as colunas tipadas
são preenchidas best-effort a partir das mesmas chaves — servindo para consultas e
relatórios SQL. A leitura reconstrói o FinRecord priorizando `extra`.
"""
from decimal import Decimal, InvalidOperation

from django.db import transaction

from .models import (
    Banco, SolicitacaoPagamento, ContaPagar, NotaFiscal, ContaReceber, EstudoLocacao,
    ReciboLocacao,
)


def _dec(v):
    try:
        return Decimal(str(v).replace(',', '.')) if v not in (None, '') else Decimal('0')
    except (InvalidOperation, ValueError, TypeError):
        return Decimal('0')


def _int(v):
    try:
        return int(v)
    except (ValueError, TypeError):
        return 0


def _str(v):
    return '' if v is None else str(v)


def _bool(v):
    return bool(v)


def _list(v):
    return v if isinstance(v, list) else []


def _soma_itens_total(itens):
    """Soma o `total` dos itens do recibo (para a coluna consultável valor_total)."""
    if not isinstance(itens, list):
        return Decimal('0')
    return sum((_dec(it.get('total')) for it in itens if isinstance(it, dict)), Decimal('0'))


# Para cada `tipo` (FinTipo): model + mapa coluna_modelo -> (chave_frontend, caster).
# `const` força valores fixos (ex.: discriminador kind da NotaFiscal).
SPECS = {
    'banco': {
        'model': Banco,
        'cols': {
            'nome': ('nome', _str), 'tipo': ('tipo', _str), 'pix': ('pix', _str),
            'empresa': ('empresa', _str), 'status': ('status', _str),
        },
    },
    'solicitacao': {
        'model': SolicitacaoPagamento,
        'cols': {
            'empresa': ('empresa', _str), 'solicitante': ('solicitante', _str),
            'tipo': ('tipo', _str), 'vinculo_tipo': ('vinculoTipo', _str),
            'vinculo_valor': ('vinculoValor', _str), 'fornecedor': ('fornecedor', _str),
            'documento': ('documento', _str), 'valor': ('valor', _dec),
            'compra': ('compra', _str), 'vencimento': ('vencimento', _str),
            'forma': ('forma', _str), 'status': ('status', _str),
            'descricao': ('descricao', _str), 'anexos': ('anexos', _list),
        },
    },
    'contaPagar': {
        'model': ContaPagar,
        'cols': {
            'type': ('type', _str), 'parent_record_id': ('parentId', _str),
            'parcela': ('parcela', _str), 'total_parcelas': ('totalParcelas', _int),
            'empresa': ('empresa', _str), 'vinculo_tipo': ('vinculoTipo', _str),
            'vinculo_valor': ('vinculoValor', _str), 'fornecedor': ('fornecedor', _str),
            'tipo': ('tipo', _str), 'natureza': ('natureza', _str), 'documento': ('documento', _str),
            'valor': ('valor', _dec), 'vencimento': ('vencimento', _str),
            'banco': ('banco', _str), 'forma': ('forma', _str), 'status': ('status', _str),
            'anexos': ('anexos', _list), 'comprovantes': ('comprovantes', _list),
            'valor_pago': ('valorPago', _dec), 'data_pagamento': ('dataPagamento', _str),
            'juros_pago': ('jurosPago', _dec),
        },
    },
    'nfe': {
        'model': NotaFiscal,
        'const': {'kind': 'nfe'},
        'cols': {
            'source_id': ('sourceId', _str), 'empresa': ('empresa', _str),
            'cliente': ('cliente', _str), 'numero': ('numero', _str),
            'emissao': ('emissao', _str), 'valor': ('original', _dec),
            'liquido': ('liquido', _dec), 'vencimento': ('vencimento', _str),
            'contrato': ('contrato', _str), 'status': ('status', _str),
        },
    },
    'nfeReq': {
        'model': NotaFiscal,
        'const': {'kind': 'nfeReq'},
        'cols': {
            'os': ('os', _str), 'empresa': ('empresa', _str), 'cliente': ('cliente', _str),
            'valor': ('valor', _dec), 'forma': ('forma', _str),
            'tipo_nfe': ('tipoNfe', _str), 'contrato': ('contrato', _str),
            'status': ('status', _str), 'anexos': ('anexos', _list),
        },
    },
    'contaReceber': {
        'model': ContaReceber,
        'cols': {
            'origem': ('origem', _str), 'empresa': ('empresa', _str),
            'cliente': ('cliente', _str), 'referencia': ('referencia', _str),
            'valor_original': ('valorOriginal', _dec), 'valor_liquido': ('valorLiquido', _dec),
            'vencimento_recebimento': ('vencimentoRecebimento', _str),
            'recebido': ('recebido', _bool), 'data_recebimento': ('dataRecebimento', _str),
            'valor_recebido': ('valorRecebido', _dec),
            'banco_recebimento': ('bancoRecebimento', _str), 'status': ('status', _str),
        },
    },
    'locEstudo': {
        'model': EstudoLocacao,
        'cols': {
            'empresa': ('empresa', _str), 'tipo': ('tipo', _str),
            'unidade': ('unidade', _str), 'vincula_os': ('vinculaOS', _str),
            'cobranca': ('cobranca', _str), 'status': ('status', _str),
        },
    },
    'reciboLocacao': {
        'model': ReciboLocacao,
        'cols': {
            'numero': ('numero', _str), 'empresa': ('empresa', _str), 'status': ('status', _str),
            'ordem_servico_backend_id': ('ordemServicoBackendId', _str),
            'ordem_servico_numero': ('ordemServicoNumero', _str),
            'medicao_id': ('medicaoId', _str), 'medicao_numero': ('medicaoNumero', _str),
            'cliente_nome': ('clienteNome', _str),
            'data_emissao': ('dataEmissao', _str), 'data_vencimento': ('dataVencimento', _str),
            'valor_total': ('itens', _soma_itens_total),
        },
    },
}

# kind do NotaFiscal -> tipo do frontend
NFE_KIND_TO_TIPO = {'nfe': 'nfe', 'nfeReq': 'nfeReq'}


def _build_instance(tipo, record):
    spec = SPECS[tipo]
    model = spec['model']
    rid = _str(record.get('id') or '').strip()
    if not rid:
        return None
    kwargs = {'record_id': rid, 'extra': record}
    for model_field, (fe_key, caster) in spec['cols'].items():
        kwargs[model_field] = caster(record.get(fe_key))
    for model_field, value in spec.get('const', {}).items():
        kwargs[model_field] = value
    return model(**kwargs)


@transaction.atomic
def replace_all(records):
    """Substitui todo o estado financeiro pelas linhas derivadas de `records`
    (lista de FinRecord). Espelha o comportamento do blob, que reescrevia tudo.
    """
    # Limpa todas as tabelas financeiras.
    for model in (Banco, SolicitacaoPagamento, ContaPagar, NotaFiscal, ContaReceber, EstudoLocacao, ReciboLocacao):
        model.objects.all().delete()

    buckets = {}
    seen_ids = set()
    for record in records or []:
        if not isinstance(record, dict):
            continue
        tipo = record.get('tipo')
        if tipo not in SPECS:
            continue
        rid = _str(record.get('id') or '').strip()
        if not rid or rid in seen_ids:
            continue
        instance = _build_instance(tipo, record)
        if instance is None:
            continue
        seen_ids.add(rid)
        buckets.setdefault(SPECS[tipo]['model'], []).append(instance)

    for model, instances in buckets.items():
        model.objects.bulk_create(instances)

    return sum(len(v) for v in buckets.values())


def _instance_to_record(tipo, inst):
    # `extra` tem o registro original completo; garantimos id/tipo coerentes.
    record = dict(inst.extra) if isinstance(inst.extra, dict) else {}
    record['id'] = inst.record_id
    record['tipo'] = tipo
    return record


def read_all():
    """Retorna a lista unificada de FinRecord a partir das tabelas relacionais."""
    out = []
    out += [_instance_to_record('banco', x) for x in Banco.objects.all()]
    out += [_instance_to_record('solicitacao', x) for x in SolicitacaoPagamento.objects.all()]
    out += [_instance_to_record('contaPagar', x) for x in ContaPagar.objects.all()]
    out += [_instance_to_record(NFE_KIND_TO_TIPO.get(x.kind, 'nfe'), x) for x in NotaFiscal.objects.all()]
    out += [_instance_to_record('contaReceber', x) for x in ContaReceber.objects.all()]
    out += [_instance_to_record('locEstudo', x) for x in EstudoLocacao.objects.all()]
    out += [_instance_to_record('reciboLocacao', x) for x in ReciboLocacao.objects.all()]
    return out

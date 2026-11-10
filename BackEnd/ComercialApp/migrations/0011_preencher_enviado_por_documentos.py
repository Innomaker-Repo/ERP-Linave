"""Preenche `Documento.enviado_por` dos documentos enviados antes do campo existir.

Fonte: o LogAtividade. Desde 2026-06-28 todo upload grava um log 'criacao' / 'Documentos'
com o CPF de quem enviou e a descrição `str(documento)` =
"<nome_original ou caminho> (<vinculo_tipo>:<vinculo_id>)" (cortada em 300 caracteres pelo
_registrar_log). Para cada documento sem autor, pega o log com essa mesma descrição mais
próximo do horário do upload (no máximo 10 min de diferença; cada log é usado uma vez só —
dois uploads iguais de pessoas diferentes não se confundem). Documento sem log que case
fica sem autor (anterior ao log, ou log apagado).
"""
from datetime import timedelta

from django.db import migrations

JANELA = timedelta(minutes=10)


def _descricao(doc):
    return f'{doc.nome_original or doc.arquivo.name} ({doc.vinculo_tipo}:{doc.vinculo_id})'[:300]


def preencher(apps, schema_editor):
    Documento = apps.get_model('ComercialApp', 'Documento')
    LogAtividade = apps.get_model('ComercialApp', 'LogAtividade')

    logs_por_descricao = {}
    for log in LogAtividade.objects.filter(acao='criacao', modulo='Documentos').exclude(usuario_cpf=''):
        logs_por_descricao.setdefault(log.descricao, []).append(log)

    usados = set()
    preenchidos = sem_log = 0
    for doc in Documento.objects.filter(enviado_por='').order_by('uploaded_at'):
        candidatos = [
            log for log in logs_por_descricao.get(_descricao(doc), [])
            if log.pk not in usados and abs(log.timestamp - doc.uploaded_at) <= JANELA
        ]
        if not candidatos:
            sem_log += 1
            continue
        log = min(candidatos, key=lambda x: abs(x.timestamp - doc.uploaded_at))
        usados.add(log.pk)
        Documento.objects.filter(pk=doc.pk).update(enviado_por=log.usuario_cpf[:14])
        preenchidos += 1

    if preenchidos or sem_log:
        print(f'\n  Documentos antigos: autor preenchido em {preenchidos}; sem log que identifique o autor: {sem_log}.')


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0010_login_bloqueio_e_dono_documento'),
    ]

    operations = [
        migrations.RunPython(preencher, migrations.RunPython.noop),
    ]

# Migração ADITIVA: cria uma coluna JSON nova com default vazio.
# Não altera nem remove nada do que já existe — as propostas já cadastradas passam a ter
# `preco_colunas_ocultas = []`, que é exatamente o comportamento anterior (todas as colunas
# visíveis). Nenhum dado é reescrito.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='preco_colunas_ocultas',
            field=models.JSONField(blank=True, default=list),
        ),
    ]

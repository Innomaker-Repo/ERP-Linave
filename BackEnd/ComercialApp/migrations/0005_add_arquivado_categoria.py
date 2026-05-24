from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0004_optional_workspace_commercial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='negocio',
            name='categoria',
            field=models.CharField(
                choices=[
                    ('Planejamento', 'Planejamento'),
                    ('Negociação', 'Negociação'),
                    ('Em Andamento', 'Em Andamento'),
                    ('Finalização', 'Finalização'),
                    ('Arquivado', 'Arquivado'),
                ],
                default='Planejamento',
                max_length=30,
            ),
        ),
    ]

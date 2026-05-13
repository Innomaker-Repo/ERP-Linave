from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0004_workspace'),
    ]

    operations = [
        migrations.AddField(
            model_name='ordenservico',
            name='horas_trabalhadas_servico',
            field=models.JSONField(blank=True, default=list),
        ),
    ]

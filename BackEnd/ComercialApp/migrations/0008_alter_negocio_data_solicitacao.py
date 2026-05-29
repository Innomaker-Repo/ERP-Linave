from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0007_alter_servico_optional_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='negocio',
            name='data_solicitacao',
            field=models.DateField(blank=True, null=True),
        ),
    ]

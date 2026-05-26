from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0006_remove_negocio_prevista_dates'),
    ]

    operations = [
        migrations.AlterField(
            model_name='servico',
            name='categoria',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='servico',
            name='local_execucao',
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.AlterField(
            model_name='servico',
            name='embarcacao',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
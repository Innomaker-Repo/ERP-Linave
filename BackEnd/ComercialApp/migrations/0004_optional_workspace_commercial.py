from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0003_rename_config_workspace_data'),
    ]

    operations = [
        migrations.AlterField(
            model_name='negocio',
            name='workspace',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='negocios',
                to='ComercialApp.workspace',
            ),
        ),
        migrations.AlterField(
            model_name='levantamento',
            name='workspace',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='levantamentos',
                to='ComercialApp.workspace',
            ),
        ),
        migrations.AlterField(
            model_name='orcamento',
            name='workspace',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='orcamentos',
                to='ComercialApp.workspace',
            ),
        ),
        migrations.AlterField(
            model_name='ordemservico',
            name='workspace',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='OS',
                to='ComercialApp.workspace',
            ),
        ),
    ]

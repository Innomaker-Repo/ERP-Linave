from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0005_add_arquivado_categoria'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='negocio',
            name='data_prevista_inicio',
        ),
        migrations.RemoveField(
            model_name='negocio',
            name='data_prevista_final',
        ),
    ]
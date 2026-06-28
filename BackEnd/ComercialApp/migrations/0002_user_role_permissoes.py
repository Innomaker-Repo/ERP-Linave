from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[('admin', 'Admin'), ('gerente', 'Gerente'), ('usuario', 'Usuário')],
                default='usuario',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='permissoes',
            field=models.JSONField(blank=True, default=dict),
        ),
        # Superusers existentes recebem role='admin'
        migrations.RunSQL(
            "UPDATE comercialapp_user SET role = 'admin' WHERE is_superuser = 1",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

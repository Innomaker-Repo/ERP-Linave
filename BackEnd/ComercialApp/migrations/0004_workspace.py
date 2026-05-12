from django.db import migrations, models
import ComercialApp.models


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0003_ordenservico'),
    ]

    operations = [
        migrations.CreateModel(
            name='Workspace',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('admin_email', models.CharField(max_length=150, unique=True)),
                ('data', models.JSONField(blank=True, default=ComercialApp.models.build_default_workspace_data)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
    ]

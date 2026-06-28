from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ComercialApp', '0002_user_role_permissoes'),
    ]

    operations = [
        migrations.CreateModel(
            name='LogAtividade',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('usuario_cpf', models.CharField(blank=True, default='', max_length=14)),
                ('usuario_nome', models.CharField(blank=True, default='', max_length=150)),
                ('acao', models.CharField(choices=[('login', 'Login'), ('criacao', 'Criação'), ('atualizacao', 'Atualização'), ('exclusao', 'Exclusão')], max_length=20)),
                ('modulo', models.CharField(blank=True, default='', max_length=100)),
                ('descricao', models.TextField(blank=True, default='')),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Log de Atividade',
                'verbose_name_plural': 'Logs de Atividade',
                'ordering': ['-timestamp'],
            },
        ),
    ]

"""Cria o workspace padrão e o usuário admin do sistema.

Uso:
    python manage.py setup_admin

Idempotente: pode ser chamado várias vezes sem duplicar dados.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Cria o workspace e o usuário admin padrão (CPF: admin / senha: admin).'

    def handle(self, *args, **options):
        from ComercialApp.models import User, Workspace

        ws, ws_criado = Workspace.objects.get_or_create(
            admin_email='admin@linave.com.br',
            defaults={'empresa_nome': 'Linave ERP'},
        )
        if ws_criado:
            self.stdout.write(f"Workspace '{ws.empresa_nome}' criado.")

        if User.objects.filter(cpf='admin').exists():
            self.stdout.write(self.style.WARNING("Usuário admin já existe. Nenhuma alteração feita."))
            return

        User.objects.create_superuser(
            cpf='admin',
            password='admin',
            nome='Administrador',
            email='admin@linave.com.br',
            cargo='Administrador do Sistema',
            departamento='TI',
            workspace=ws,
        )
        self.stdout.write(self.style.SUCCESS(
            "Usuário admin criado com sucesso!\n"
            "  CPF (login): admin\n"
            "  Senha:       admin\n"
            "  Acesso:      total (is_superuser=True)"
        ))

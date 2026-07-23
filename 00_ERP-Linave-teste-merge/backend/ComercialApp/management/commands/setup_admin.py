"""Cria ou atualiza o workspace padrão e o usuário admin do sistema.

Uso:
    python manage.py setup_admin

Idempotente: pode ser chamado várias vezes; atualiza email/senha/role do admin existente.
"""
from django.core.management.base import BaseCommand

ADMIN_CPF = 'admin'
ADMIN_EMAIL = 'admin@linave.com.br'
ADMIN_PASSWORD = 'Admin@linave'


class Command(BaseCommand):
    help = 'Cria ou atualiza o workspace e o usuário admin padrão.'

    def handle(self, *args, **options):
        from ComercialApp.models import User, Workspace

        ws, ws_criado = Workspace.objects.get_or_create(
            admin_email=ADMIN_EMAIL,
            defaults={'empresa_nome': 'Linave ERP'},
        )
        if ws_criado:
            self.stdout.write(f"Workspace '{ws.empresa_nome}' criado.")

        admin, criado = User.objects.get_or_create(
            cpf=ADMIN_CPF,
            defaults={'nome': 'Administrador', 'cargo': 'Administrador do Sistema', 'departamento': 'TI'},
        )
        admin.email = ADMIN_EMAIL
        admin.role = 'admin'   # save() sincroniza is_superuser/is_staff automaticamente
        admin.is_active = True
        admin.workspace = ws
        admin.set_password(ADMIN_PASSWORD)
        admin.save()

        acao = "criado" if criado else "atualizado"
        self.stdout.write(self.style.SUCCESS(
            f"Usuário admin {acao} com sucesso!\n"
            f"  CPF (login): {ADMIN_CPF}\n"
            f"  E-mail:      {ADMIN_EMAIL}\n"
            f"  Senha:       {ADMIN_PASSWORD}\n"
            f"  Acesso:      total (role=admin)"
        ))

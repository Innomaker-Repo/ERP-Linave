"""Desbloqueia uma conta travada por excesso de senhas erradas no login.

Uso:
    python manage.py desbloquear_usuario <cpf>

Pelo sistema, o desbloqueio é feito por um admin no painel de Usuários. Este comando existe
para quando a conta bloqueada é a do próprio admin (no Docker:
`docker exec -it erp_backend python manage.py desbloquear_usuario admin`).
"""
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Desbloqueia uma conta bloqueada por tentativas de login com senha incorreta.'

    def add_arguments(self, parser):
        parser.add_argument('cpf', help='CPF (login) do usuário a desbloquear.')

    def handle(self, *args, **options):
        from ComercialApp.models import User

        from ComercialApp.auth_backends import desbloquear

        usuarios = User.objects.filter(cpf=options['cpf'])
        if not usuarios.exists():
            raise CommandError(f"Usuário '{options['cpf']}' não encontrado.")
        desbloquear(usuarios)
        self.stdout.write(self.style.SUCCESS(f"Usuário '{options['cpf']}' desbloqueado."))

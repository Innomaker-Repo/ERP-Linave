"""Cria ou atualiza o workspace padrão e o usuário admin do sistema.

Uso:
    python manage.py setup_admin              # cria, ou redefine a senha do admin existente
    python manage.py setup_admin --if-missing # só cria se não existir (usado no docker-compose)

Senha: vem da variável de ambiente DJANGO_ADMIN_PASSWORD. Sem ela, é gerada uma senha
aleatória, impressa UMA vez na saída do comando (no Docker: `docker logs erp_backend`).
Nunca existe senha fixa no código — a antiga ('Admin@linave') está no histórico do git,
por isso o `--if-missing` também troca a senha de um admin que ainda a esteja usando.
"""
import os
import secrets
import string

from django.core.management.base import BaseCommand

ADMIN_CPF = 'admin'
ADMIN_EMAIL = 'admin@linave.com.br'
# Senha padrão que ficou publicada no repositório. Só é usada para DETECTAR um admin que
# ainda a mantém e trocá-la — nunca para definir senha.
SENHA_PADRAO_ANTIGA = 'Admin@linave'


def gerar_senha():
    """Senha aleatória que passa no SenhaSeguraValidator (maiúscula, minúscula, especial)."""
    alfabeto = string.ascii_letters + string.digits
    miolo = ''.join(secrets.choice(alfabeto) for _ in range(16))
    return f'{secrets.choice(string.ascii_uppercase)}{secrets.choice(string.ascii_lowercase)}{miolo}@'


class Command(BaseCommand):
    help = 'Cria ou atualiza o workspace e o usuário admin padrão.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--if-missing',
            action='store_true',
            help='Cria o workspace e o usuário admin apenas se não existirem.',
        )

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
        senha_env = os.environ.get('DJANGO_ADMIN_PASSWORD', '').strip()

        if options['if_missing'] and not criado:
            if not admin.check_password(SENHA_PADRAO_ANTIGA):
                self.stdout.write("Usuário admin já existe; não será atualizado (opção --if-missing).")
                return
            # Admin existente ainda com a senha que vazou no repositório: troca já.
            senha = senha_env or gerar_senha()
            admin.set_password(senha)
            admin.save()
            self.stdout.write(self.style.WARNING(
                "ATENÇÃO: o admin ainda usava a senha padrão publicada no repositório e ela foi trocada."
            ))
            self._informar_senha(senha, gerada=not senha_env)
            return

        senha = senha_env or gerar_senha()
        admin.email = ADMIN_EMAIL
        admin.role = 'admin'   # save() sincroniza is_superuser/is_staff automaticamente
        admin.is_active = True
        admin.workspace = ws
        admin.set_password(senha)
        admin.save()

        acao = "criado" if criado else "atualizado"
        self.stdout.write(self.style.SUCCESS(
            f"Usuário admin {acao} com sucesso!\n"
            f"  CPF (login): {ADMIN_CPF}\n"
            f"  E-mail:      {ADMIN_EMAIL}\n"
            f"  Acesso:      total (role=admin)"
        ))
        self._informar_senha(senha, gerada=not senha_env)

    def _informar_senha(self, senha, gerada):
        if gerada:
            self.stdout.write(self.style.WARNING(
                f"  Senha gerada: {senha}\n"
                f"  Guarde agora — ela não será exibida de novo. Troque-a em \"Meu Perfil\"."
            ))
        else:
            self.stdout.write("  Senha:       definida por DJANGO_ADMIN_PASSWORD")

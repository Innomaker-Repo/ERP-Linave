"""Recria o banco de dados do zero (DROP + CREATE) e aplica o schema completo
a partir da migration inicial única.

Uso em qualquer máquina (nova ou divergente):

    python manage.py reset_db            # pede confirmação
    python manage.py reset_db --noinput  # sem perguntar

Apaga TODOS os dados — pensado para a fase de testes, em que o schema dos models é
a fonte da verdade e não se quer gerenciar migrations incrementais.
"""
import pymysql
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    help = 'Apaga e recria o banco, depois aplica o schema (migration inicial única).'

    def add_arguments(self, parser):
        parser.add_argument('--noinput', action='store_true', help='Não pedir confirmação.')

    def handle(self, *args, **options):
        db = settings.DATABASES['default']
        name = db['NAME']

        if not options['noinput']:
            resp = input(f"Isto APAGA e recria o banco '{name}'. Digite 'sim' para continuar: ")
            if resp.strip().lower() != 'sim':
                self.stdout.write('Cancelado.')
                return

        # Fecha conexões do Django antes de dropar o banco que ele usa.
        connections.close_all()

        conn = pymysql.connect(
            host=db['HOST'], user=db['USER'], password=db['PASSWORD'], port=int(db.get('PORT') or 3306),
        )
        try:
            with conn.cursor() as cur:
                cur.execute(f"DROP DATABASE IF EXISTS `{name}`")
                cur.execute(f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            conn.commit()
        finally:
            conn.close()

        self.stdout.write(self.style.WARNING(f"Banco '{name}' recriado vazio. Aplicando schema..."))
        call_command('migrate', interactive=False, verbosity=1)

        # Semeia os dados fixos (OS internas 1000 Linave / 2000 Servinave).
        from ComercialApp.management.commands.seed_os_interna import seed_os_interna
        seed_os_interna(self.stdout)

        self.stdout.write(self.style.SUCCESS("Banco pronto! Schema completo aplicado — nada mais a migrar."))

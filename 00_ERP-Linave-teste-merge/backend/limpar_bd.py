"""Limpa todos os dados do banco de dados do projeto Django.

Uso:
    python limpar_bd.py

Esse script apaga os dados das tabelas do banco atual e preserva a
tabela de migrações para manter a estrutura do schema.
"""

from pathlib import Path
import os
import sys

from django.core.management import call_command
from django.db import connection


BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ERP_Linave_BackEnd.settings')


def main() -> None:
    table_names = [
        table_name
        for table_name in connection.introspection.table_names()
        if table_name != 'django_migrations'
    ]

    with connection.cursor() as cursor:
        cursor.execute('SET FOREIGN_KEY_CHECKS = 0')
        try:
            for table_name in table_names:
                cursor.execute(f'TRUNCATE TABLE `{table_name}`')
        finally:
            cursor.execute('SET FOREIGN_KEY_CHECKS = 1')

    print('Banco de dados limpo com sucesso.')


if __name__ == '__main__':
    import django

    django.setup()
    main()
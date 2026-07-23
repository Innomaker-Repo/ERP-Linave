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
from django.core.management.base import BaseCommand, CommandError
from django.db import connections


class Command(BaseCommand):
    help = 'Apaga e recria o banco, depois aplica o schema (migration inicial única).'

    def add_arguments(self, parser):
        parser.add_argument('--noinput', action='store_true', help='Não pedir confirmação.')

    def handle(self, *args, **options):
        db = settings.DATABASES['default']
        name = db['NAME']

        print("\n========== RESET DO BANCO DE DADOS ==========", flush=True)

        if not options['noinput']:
            resp = input(f"Isto APAGA e recria o banco '{name}'. Digite 'sim' para continuar: ")
            if resp.strip().lower() != 'sim':
                print("Cancelado pelo usuario.", flush=True)
                return

        # Fecha conexões do Django antes de dropar o banco que ele usa.
        print("[1/6] Fechando conexoes ativas do Django...", flush=True)
        connections.close_all()

        host = db.get('HOST') or 'localhost'
        user = db.get('USER') or 'root'
        port = int(db.get('PORT') or 3306)
        print(f"[2/6] Conectando ao MySQL em {user}@{host}:{port}...", flush=True)
        try:
            conn = pymysql.connect(
                host=host, user=user, password=db.get('PASSWORD') or '',
                port=port, charset='utf8mb4',
            )
        except pymysql.err.OperationalError as exc:
            # Erro clássico: senha/usuário/host errados em settings.DATABASES.
            raise CommandError(
                f"Não foi possível conectar ao MySQL em {user}@{host}:{port}.\n"
                f"  MySQL respondeu: {exc.args[1] if len(exc.args) > 1 else exc}\n"
                f"  Verifique USER/PASSWORD/HOST/PORT em "
                f"ERP_Linave_BackEnd/settings.py -> DATABASES['default'] "
                f"e se o servidor MySQL está rodando."
            )
        print("      Conexao com o MySQL estabelecida.", flush=True)
        print(f"[3/6] Recriando o banco '{name}' (DROP + CREATE)...", flush=True)
        try:
            with conn.cursor() as cur:
                cur.execute(f"DROP DATABASE IF EXISTS `{name}`")
                cur.execute(f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            conn.commit()
        finally:
            conn.close()
        print(f"      Banco '{name}' recriado vazio.", flush=True)

        print("[4/6] Aplicando o schema (migrations)...", flush=True)
        call_command('migrate', interactive=False, verbosity=1)

        # Semeia os dados fixos (OS internas 1000 Linave / 2000 Servinave).
        print("[5/6] Semeando dados fixos (OS internas 1000/2000)...", flush=True)
        from ComercialApp.management.commands.seed_os_interna import seed_os_interna
        seed_os_interna(self.stdout)

        # Cria workspace e usuário admin padrão.
        print("[6/6] Criando workspace e usuario admin padrao...", flush=True)
        call_command('setup_admin')

        print("\nBanco pronto! Schema completo aplicado.", flush=True)

        # Confere se o reset realmente montou o banco corretamente.
        self._verificar(name)

    def _verificar(self, name):
        """Consulta o banco recém-criado e imprime um checklist do que foi montado."""
        from django.db import connection
        from django.db.migrations.executor import MigrationExecutor
        from ComercialApp.models import LogAtividade, OrdemServico, User, Workspace

        print("", flush=True)
        print(f"=== Verificacao do banco '{name}' ===", flush=True)

        falhas = []

        def checar(descricao, condicao, detalhe=""):
            ok = bool(condicao)
            marca = "[OK]   " if ok else "[FALHA]"
            print(f"{marca} {descricao}" + (f"  ->  {detalhe}" if detalhe else ""), flush=True)
            if not ok:
                falhas.append(descricao)

        # 1) Tabelas criadas no banco.
        tabelas = connection.introspection.table_names()
        checar("Tabelas criadas no banco", len(tabelas) > 0, f"{len(tabelas)} tabelas")

        # 2) Nenhuma migration pendente (schema 100% aplicado).
        executor = MigrationExecutor(connection)
        pendentes = executor.migration_plan(executor.loader.graph.leaf_nodes())
        checar("Todas as migrations aplicadas", not pendentes,
               "nada pendente" if not pendentes else f"{len(pendentes)} pendente(s)")

        # 3) Campos novos do User (role/permissoes) presentes no schema.
        campos_user = {f.name for f in User._meta.get_fields()}
        checar("User tem campos role e permissoes", {'role', 'permissoes'} <= campos_user)

        # 4) Tabela nova LogAtividade acessível.
        try:
            checar("Tabela LogAtividade acessivel", True, f"{LogAtividade.objects.count()} registros")
        except Exception as exc:  # noqa: BLE001
            checar("Tabela LogAtividade acessivel", False, str(exc)[:60])

        # 5) Usuario admin criado com acesso total.
        admin = User.objects.filter(cpf='admin').first()
        checar("Usuario admin criado", admin is not None,
               "" if admin is None else f"role={admin.role}, superuser={admin.is_superuser}")
        checar("Admin com acesso total (role=admin e superuser)",
               admin is not None and admin.role == 'admin' and admin.is_superuser)

        # 6) Workspace padrao criado.
        checar("Workspace padrao criado", Workspace.objects.exists())

        # 7) OS internas semeadas (1000 Linave / 2000 Servinave).
        internas = set(OrdemServico.objects.values_list('numero_os', flat=True))
        checar("OS internas 1000 e 2000 semeadas", {'1000', '2000'} <= internas,
               f"encontradas: {sorted(internas)}")

        print("", flush=True)
        if falhas:
            raise CommandError(
                f"Verificacao encontrou {len(falhas)} problema(s): " + "; ".join(falhas)
            )
        print("Verificacao concluida: reset do banco OK!", flush=True)
        print("=============================================\n", flush=True)

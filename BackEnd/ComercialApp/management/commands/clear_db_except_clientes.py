from django.core.management.base import BaseCommand
from django.db import transaction

from ComercialApp.models import (
    Ativ_prevista,
    Levantamento,
    MDO,
    Material,
    Negocio,
    OrdenServico,
    Orcamento,
    Resumo_orcamento,
    Servico,
    Servico_terceirizado,
    User,
    Workspace,
)


class Command(BaseCommand):
    help = 'Remove todos os dados do ComercialApp exceto os clientes.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep-workspace',
            action='store_true',
            help='Mantém o workspace salvo em vez de apagá-lo.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        keep_workspace = options['keep_workspace']

        models_to_clear = [
            Ativ_prevista,
            MDO,
            Material,
            Servico_terceirizado,
            Orcamento,
            Resumo_orcamento,
            Levantamento,
            OrdenServico,
            Negocio,
            Servico,
            User,
        ]

        deleted_summary = []

        for model in models_to_clear:
            count = model.objects.count()
            model.objects.all().delete()
            deleted_summary.append(f'{model.__name__}: {count}')

        if not keep_workspace:
            workspace_count = Workspace.objects.count()
            Workspace.objects.all().delete()
            deleted_summary.append(f'Workspace: {workspace_count}')

        self.stdout.write(self.style.SUCCESS('Limpeza concluída. Clientes preservados.'))
        for line in deleted_summary:
            self.stdout.write(f'- {line}')
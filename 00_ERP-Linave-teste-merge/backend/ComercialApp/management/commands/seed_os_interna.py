"""Semeia os negócios + OS de USO INTERNO no banco:
  - OS 1000  -> LINAVE   (uso interno)
  - OS 2000  -> SERVINAVE (uso interno)

Servem de centro de custo para compras/almoxarifado/alocação internos (café, papel, etc.).
São "fake" e ficam fora do CRM/Orçamento/Proposta/Medição (flag uso_interno no negócio).

Idempotente (get_or_create). É chamado automaticamente pelo `reset_db`, mas também pode
ser rodado isolado:  python manage.py seed_os_interna
"""
import datetime

from django.core.management.base import BaseCommand

from ComercialApp.models import Cliente, Negocio, OrdemServico


def seed_os_interna(stdout=None):
    hoje = datetime.date.today()

    cliente, _ = Cliente.objects.get_or_create(
        documento='USO-INTERNO',
        defaults={'tipo': 'Juridica', 'razao_social': 'USO INTERNO', 'status': 'Ativo'},
    )

    base = [
        {'numero': '1000', 'empresa': 'Linave'},
        {'numero': '2000', 'empresa': 'Servinave'},
    ]
    criados = 0
    for d in base:
        negocio, _ = Negocio.objects.get_or_create(
            uso_interno=True,
            empresa_prestadora=d['empresa'],
            defaults={
                'cliente': cliente,
                'nome_negocio': f"USO INTERNO - {d['empresa'].upper()} (OS {d['numero']})",
                'solicitante': 'Sistema',
                'email': 'interno@linave.com.br',
                'categoria': 'Em Andamento',
                'status': 'Uso interno',
                'tipo_servico': 'Uso interno',
                'orcamento_realizado': True,
                'requer_reorcamento': False,
            },
        )
        _, created = OrdemServico.objects.get_or_create(
            numero_os=d['numero'],
            defaults={
                'cliente': cliente,
                'negocio': negocio,
                'local': f"Uso interno {d['empresa']}",
                'projeto': f"USO INTERNO - {d['empresa'].upper()}",
                'cc': d['numero'],
                'data_inicio_previsto': hoje,
                'data_termino_previsto': hoje,
                'supervisor_encarregado': 'Uso Interno',
                'descricao_geral_servico': (
                    f"OS de uso interno ({d['empresa']}) para compras/almoxarifado internos "
                    f"(café, papel, etc.)."
                ),
                'status_os': 'emproducao',
                'status_envio': 'enviada',
                'status_aprovacao': 'aprovada',
            },
        )
        if created:
            criados += 1

    if stdout:
        stdout.write(f"OS internas garantidas (1000=Linave, 2000=Servinave). Novas criadas: {criados}.")
    return criados


class Command(BaseCommand):
    help = 'Semeia os negócios + OS de uso interno (1000 Linave, 2000 Servinave).'

    def handle(self, *args, **options):
        seed_os_interna(self.stdout)
        self.stdout.write(self.style.SUCCESS('Seed de OS internas concluído.'))

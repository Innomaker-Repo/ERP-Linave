from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from django.db import transaction

from .models import (
    TabelaEstoque, ItemEstoque, TipoGas,
    AlocacaoGas, HistoricoBaixa, HistoricoAlocacao,
)
from .serializers import (
    TabelaEstoqueSerializer, ItemEstoqueSerializer, TipoGasSerializer,
    AlocacaoGasSerializer, HistoricoBaixaSerializer, HistoricoAlocacaoSerializer,
)


def get_workspace_email(request):
    """Extrai o e-mail do workspace a partir do header X-Workspace-Email ou query param."""
    return (
        request.headers.get('X-Workspace-Email', '')
        or request.query_params.get('workspace_email', '')
    )


# ──────────────────────────────────────────────────────────────────────────────
# TabelaEstoque
# ──────────────────────────────────────────────────────────────────────────────

class TabelaEstoqueViewSet(viewsets.ModelViewSet):
    serializer_class = TabelaEstoqueSerializer

    def get_queryset(self):
        email = get_workspace_email(self.request)
        qs = TabelaEstoque.objects.prefetch_related('itens')
        if email:
            qs = qs.filter(workspace_email=email)
        return qs

    def create(self, request, *args, **kwargs):
        email = get_workspace_email(request)
        data = request.data.copy()
        data['workspace_email'] = email
        tabela, created = TabelaEstoque.objects.get_or_create(
            workspace_email=email,
            nome=data.get('nome', ''),
        )
        serializer = self.get_serializer(tabela)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)


# ──────────────────────────────────────────────────────────────────────────────
# ItemEstoque
# ──────────────────────────────────────────────────────────────────────────────

class ItemEstoqueViewSet(viewsets.ModelViewSet):
    serializer_class = ItemEstoqueSerializer

    def get_queryset(self):
        email = get_workspace_email(self.request)
        qs = ItemEstoque.objects.select_related('tabela')
        if email:
            qs = qs.filter(tabela__workspace_email=email)
        tabela_nome = self.request.query_params.get('tabela_nome')
        if tabela_nome:
            qs = qs.filter(tabela__nome=tabela_nome)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        email = get_workspace_email(request)
        tabela_nome = request.data.get('tabela_nome')
        if not tabela_nome:
            return Response({'error': 'tabela_nome é obrigatório'}, status=status.HTTP_400_BAD_REQUEST)

        tabela, _ = TabelaEstoque.objects.get_or_create(
            workspace_email=email,
            nome=tabela_nome,
        )

        data = {
            'tabela': tabela.pk,
            'item_id': request.data.get('item_id', ''),
            'values': request.data.get('values', {}),
            'search_text': request.data.get('search_text', ''),
        }
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        data = {
            'values': request.data.get('values', instance.values),
            'search_text': request.data.get('search_text', instance.search_text),
            'item_id': request.data.get('item_id', instance.item_id),
            'tabela': instance.tabela.pk,
        }
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ──────────────────────────────────────────────────────────────────────────────
# TipoGas
# ──────────────────────────────────────────────────────────────────────────────

class TipoGasViewSet(viewsets.ModelViewSet):
    serializer_class = TipoGasSerializer

    def get_queryset(self):
        email = get_workspace_email(self.request)
        qs = TipoGas.objects.all()
        if email:
            qs = qs.filter(workspace_email=email)
        return qs

    def create(self, request, *args, **kwargs):
        email = get_workspace_email(request)
        nome = request.data.get('nome', '')
        obj, created = TipoGas.objects.get_or_create(workspace_email=email, nome=nome)
        serializer = self.get_serializer(obj)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=code)


# ──────────────────────────────────────────────────────────────────────────────
# AlocacaoGas
# ──────────────────────────────────────────────────────────────────────────────

class AlocacaoGasViewSet(viewsets.ModelViewSet):
    serializer_class = AlocacaoGasSerializer

    def get_queryset(self):
        email = get_workspace_email(self.request)
        qs = AlocacaoGas.objects.select_related('fornecedor_item')
        if email:
            qs = qs.filter(workspace_email=email)
        return qs

    def create(self, request, *args, **kwargs):
        email = get_workspace_email(request)
        data = request.data.copy()
        data['workspace_email'] = email
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ──────────────────────────────────────────────────────────────────────────────
# HistoricoBaixa
# ──────────────────────────────────────────────────────────────────────────────

class HistoricoBaixaViewSet(viewsets.ModelViewSet):
    serializer_class = HistoricoBaixaSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        email = get_workspace_email(self.request)
        qs = HistoricoBaixa.objects.all()
        if email:
            qs = qs.filter(workspace_email=email)
        return qs

    def create(self, request, *args, **kwargs):
        email = get_workspace_email(request)
        data = request.data.copy()
        data['workspace_email'] = email
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ──────────────────────────────────────────────────────────────────────────────
# HistoricoAlocacao
# ──────────────────────────────────────────────────────────────────────────────

class HistoricoAlocacaoViewSet(viewsets.ModelViewSet):
    serializer_class = HistoricoAlocacaoSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        email = get_workspace_email(self.request)
        qs = HistoricoAlocacao.objects.all()
        if email:
            qs = qs.filter(workspace_email=email)
        return qs

    def create(self, request, *args, **kwargs):
        email = get_workspace_email(request)
        data = request.data.copy()
        data['workspace_email'] = email
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ──────────────────────────────────────────────────────────────────────────────
# Endpoint agregado: carrega TODO o estado do almoxarifado de uma só vez
# GET /almoxarifado/estoque-completo/?workspace_email=...
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def estoque_completo(request):
    """
    Retorna todos os dados do almoxarifado em um único request,
    no formato esperado pelo frontend:
    {
      tables: [ { name, columns: [], rows: [...] } ],
      gasTypes: [...],
      allocations: [...],
      baixasHistorico: [...],
      alocacoesHistorico: [...]
    }
    """
    email = get_workspace_email(request)

    tabelas = TabelaEstoque.objects.prefetch_related('itens').filter(workspace_email=email)
    tipos_gas = TipoGas.objects.filter(workspace_email=email).values_list('nome', flat=True)
    alocacoes = AlocacaoGas.objects.filter(workspace_email=email).select_related('fornecedor_item')
    baixas = HistoricoBaixa.objects.filter(workspace_email=email)
    hist_aloc = HistoricoAlocacao.objects.filter(workspace_email=email)

    tables_data = []
    for tabela in tabelas:
        rows = []
        for item in tabela.itens.all():
            rows.append({
                'id': item.item_id or str(item.pk),
                '_dbId': item.pk,
                'tableName': tabela.nome,
                'values': item.values,
                'searchText': item.search_text,
            })
        tables_data.append({
            '_dbId': tabela.pk,
            'name': tabela.nome,
            'columns': [],
            'rows': rows,
        })

    allocations_data = []
    for a in alocacoes:
        allocations_data.append({
            'id': str(a.pk),
            'supplierRowId': a.fornecedor_item.item_id or str(a.fornecedor_item.pk),
            'gasName': a.gas_nome,
            'quantity': a.quantidade,
            'local': a.local,
            'serviceOS': a.service_os,
        })

    baixas_data = []
    for b in baixas:
        baixas_data.append({
            'id': str(b.pk),
            'dataBaixa': str(b.data_baixa),
            'tableName': b.tabela_nome,
            'itemLabel': b.item_label,
            'statusAnterior': b.status_anterior,
            'motivo': b.motivo,
            'osId': b.os_id,
            'osLabel': b.os_label,
            'localizacao': b.localizacao,
            'serviceOS': b.service_os,
            'snapshot': b.snapshot,
        })

    hist_aloc_data = []
    for h in hist_aloc:
        hist_aloc_data.append({
            'id': str(h.pk),
            'action': h.action,
            'kind': h.kind,
            'dataEvento': h.data_evento.isoformat(),
            'osId': h.os_id,
            'osLabel': h.os_label,
            'itemLabel': h.item_label,
            'tableName': h.tabela_nome,
            'quantity': h.quantidade,
            'local': h.local,
            'gasName': h.gas_nome,
        })

    return Response({
        'tables': tables_data,
        'gasTypes': list(tipos_gas),
        'allocations': allocations_data,
        'baixasHistorico': baixas_data,
        'alocacoesHistorico': hist_aloc_data,
    })

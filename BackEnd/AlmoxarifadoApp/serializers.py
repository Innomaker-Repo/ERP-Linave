from rest_framework import serializers
from .models import (
    TabelaEstoque, ItemEstoque, TipoGas,
    AlocacaoGas, HistoricoBaixa, HistoricoAlocacao,
)


class ItemEstoqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemEstoque
        fields = ['id', 'tabela', 'item_id', 'values', 'search_text', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TabelaEstoqueSerializer(serializers.ModelSerializer):
    itens = ItemEstoqueSerializer(many=True, read_only=True)

    class Meta:
        model = TabelaEstoque
        fields = ['id', 'nome', 'workspace_email', 'itens']
        read_only_fields = ['id']


class TipoGasSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoGas
        fields = ['id', 'workspace_email', 'nome']
        read_only_fields = ['id']


class AlocacaoGasSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlocacaoGas
        fields = [
            'id', 'workspace_email', 'fornecedor_item',
            'gas_nome', 'quantidade', 'local', 'service_os', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class HistoricoBaixaSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricoBaixa
        fields = [
            'id', 'workspace_email', 'data_baixa', 'tabela_nome', 'item_label',
            'status_anterior', 'motivo', 'os_id', 'os_label',
            'localizacao', 'service_os', 'snapshot', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class HistoricoAlocacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricoAlocacao
        fields = [
            'id', 'workspace_email', 'action', 'kind', 'data_evento',
            'os_id', 'os_label', 'item_label', 'tabela_nome',
            'quantidade', 'local', 'gas_nome',
        ]
        read_only_fields = ['id', 'data_evento']

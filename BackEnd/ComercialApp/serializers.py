from rest_framework import serializers
from .models import (
    Cliente, Negocio, Servico, User,
    Levantamento, MDO, Ativ_prevista, Material, 
    Servico_terceirizado, Orcamento, Resumo_orcamento,
    OrdenServico, Workspace, normalize_workspace_data,
    Escopo, PropostaComercial
)

# ----------------- Core ------------------

class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class ClienteSerializer(serializers.ModelSerializer):
    negocios = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Cliente
        fields = '__all__'

class NegocioSerializer(serializers.ModelSerializer):
    # 'servicos' usa o related_name definido no model Servico
    servicos = ServicoSerializer(many=True, read_only=True)
    
    # Objeto completo do cliente para evitar múltiplas chamadas no React
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)

    class Meta:
        model = Negocio
        # '__all__' agora inclui automaticamente o campo 'categoria' adicionado ao Model
        fields = '__all__'

# ------------------ Orçamento Items -------------------

class MDOSerializer(serializers.ModelSerializer):
    valor_total = serializers.ReadOnlyField() 
    class Meta:
        model = MDO
        fields = '__all__'

class Ativ_previstaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ativ_prevista
        fields = '__all__'

class MaterialSerializer(serializers.ModelSerializer):
    valor_total = serializers.ReadOnlyField()
    class Meta:
        model = Material
        fields = '__all__'

class ServicosTerceirizadosSerializer(serializers.ModelSerializer):
    valor_tot = serializers.ReadOnlyField()
    class Meta:
        model = Servico_terceirizado
        fields = '__all__'

<<<<<<< Updated upstream
class EscopoSerializer(serializers.ModelSerializer):
    tipo_detalhes = ServicoSerializer(source='tipo', read_only=True)

    class Meta:
        model = Escopo
        fields = '__all__'

class PropostaComercialSerializer(serializers.ModelSerializer):
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    negocio_detalhes = NegocioSerializer(source='negocio', read_only=True)
    proposta_escopo = EscopoSerializer(many=True, read_only=True)
    proposta_escopo_input = EscopoSerializer(source='proposta_escopo', many=True, write_only=True, required=False)

    class Meta:
        model = PropostaComercial
        fields = [
            'id', 'data_criacao', 'cliente', 'cliente_detalhes',
            'negocio', 'negocio_detalhes', 'referencia', 'saudacao',
            'assunto', 'texto_de_abertura', 'responsabilidade_contratada',
            'responsabilidade_contratante', 'preco', 'condicoes_gerais',
            'condicoes_pagamento', 'prazo', 'encerramento',
            'proposta_escopo', 'proposta_escopo_input'
        ]

# ------------------  The Summary & Container  -------------------
=======
# ------------------ The Summary & Container -------------------
>>>>>>> Stashed changes

class Resumo_orcamentoSerializer(serializers.ModelSerializer):
    total_mdo = serializers.ReadOnlyField()
    total_material = serializers.ReadOnlyField()
    total_serv_terceirizado = serializers.ReadOnlyField()
    custo_bruto = serializers.ReadOnlyField()
    custo_com_impostos = serializers.ReadOnlyField()
    custo_por_unidade = serializers.ReadOnlyField()

    class Meta:
        model = Resumo_orcamento
        fields = '__all__' 

class LevantamentoSerializer(serializers.ModelSerializer):
    responsavel_financeiro = serializers.ReadOnlyField()
    class Meta:
        model = Levantamento
        fields = '__all__'

class OrcamentoSerializer(serializers.ModelSerializer):
    levantamento = LevantamentoSerializer(read_only=True)
    resumo = Resumo_orcamentoSerializer(read_only=True)
    
    materiais = MaterialSerializer(many=True, read_only=True)
    mao_de_obra = MDOSerializer(many=True, read_only=True)
    terceirizados = ServicosTerceirizadosSerializer(many=True, read_only=True)
    atividades = Ativ_previstaSerializer(many=True, read_only=True)

    levantamento_id = serializers.PrimaryKeyRelatedField(
        queryset=Levantamento.objects.all(),
        source='levantamento',
        write_only=True
    )
    resumo_input = Resumo_orcamentoSerializer(source='resumo', write_only=True)

    class Meta:
        model = Orcamento
        fields = [
            'id', 'levantamento', 'levantamento_id', 
            'resumo', 'resumo_input', 'Observacoes_setor_orcamento',
            'materiais', 'mao_de_obra', 'terceirizados', 'atividades'
        ]

    def create(self, validated_data):
        resumo_data = validated_data.pop('resumo')
        resumo_obj = Resumo_orcamento.objects.create(**resumo_data)
        orcamento = Orcamento.objects.create(resumo=resumo_obj, **validated_data)
        return orcamento

# --------------------- Ordem de Servico (OS) ---------------------

class OrdenServicoSerializer(serializers.ModelSerializer):
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    negocio_detalhes = NegocioSerializer(source='negocio', read_only=True)
    
    cliente_id = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source='cliente',
        write_only=True
    )
    negocio_id = serializers.PrimaryKeyRelatedField(
        queryset=Negocio.objects.all(),
        source='negocio',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = OrdenServico
        fields = [
            'id', 'numero_os', 'data_emissao',
            'cliente', 'cliente_id', 'cliente_detalhes',
            'negocio', 'negocio_id', 'negocio_detalhes',
            'projeto', 'equipamento', 'local', 'cc',
            'data_inicio_previsto', 'data_termino_previsto',
            'supervisor_encarregado', 'descricao_geral_servico',
            'a_ser_incluido', 'mao_obra', 'horas_trabalhadas_servico',
            'status_os', 'status_envio', 'status_aprovacao',
            'data_aprovacao', 'documento_assinatura_aprovacao',
            'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'numero_os', 'data_emissao', 'created_at', 'updated_at')
    
    def create(self, validated_data):
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        numero_os = f"OS-{timestamp}"
        
        contador = 1
        numero_original = numero_os
        while OrdenServico.objects.filter(numero_os=numero_os).exists():
            numero_os = f"{numero_original}-{contador}"
            contador += 1
        
        validated_data['numero_os'] = numero_os
        return super().create(validated_data)

class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def validate_data(self, value):
        return normalize_workspace_data(value)

    def create(self, validated_data):
        validated_data['data'] = normalize_workspace_data(validated_data.get('data', {}))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'data' in validated_data:
            instance.data = normalize_workspace_data(validated_data['data'])
            validated_data.pop('data', None)
        return super().update(instance, validated_data)
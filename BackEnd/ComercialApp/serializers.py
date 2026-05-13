from rest_framework import serializers
from .models import (
    Cliente, Negocio, Servico, User,
    Levantamento, MDO, Ativ_prevista, Material, 
    Servico_terceirizado, Orcamento, Resumo_orcamento,
    OrdenServico,Planilhas,PropostaComercial,Escopo, Workspace, normalize_workspace_data
)

# ----------------- Core (These are perfect) ------------------

class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class ClienteSerializer(serializers.ModelSerializer):
    # Usa apenas IDs aqui para evitar dependência circular com NegocioSerializer
    negocios = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Cliente
        fields = '__all__'

class NegocioSerializer(serializers.ModelSerializer):
    # 'servicos' é o related_name definido no model Servico
    servicos = ServicoSerializer(many=True, read_only=True)
    
    # 'cliente' vai trazer o objeto completo do cliente em vez de só o ID
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)

    class Meta:
        model = Negocio
        fields = '__all__'

# ------------------  Orçamento Items -------------------

class MDOSerializer(serializers.ModelSerializer):
    # Added valor_total property so the frontend sees the math
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

# ------------------  The Summary & Container  -------------------

class Resumo_orcamentoSerializer(serializers.ModelSerializer):
    # We must explicitly add the @property fields, otherwise DRF ignores them
    total_mdo = serializers.ReadOnlyField()
    total_material = serializers.ReadOnlyField()
    total_serv_terceirizado = serializers.ReadOnlyField()
    custo_bruto = serializers.ReadOnlyField()
    custo_com_impostos = serializers.ReadOnlyField()
    custo_por_unidade = serializers.ReadOnlyField()

    class Meta:
        model = Resumo_orcamento
        # These properties are now the main data here
        fields = '__all__' 

class LevantamentoSerializer(serializers.ModelSerializer):
    # Include the property shortcuts you built
    responsavel_financeiro = serializers.ReadOnlyField()
    class Meta:
        model = Levantamento
        fields = '__all__'

class OrcamentoSerializer(serializers.ModelSerializer):
    # --- LEITURA (GET) ---
    levantamento = LevantamentoSerializer(read_only=True)
    resumo = Resumo_orcamentoSerializer(read_only=True)
    
    # Listas detalhadas para o frontend
    materiais = MaterialSerializer(many=True, read_only=True)
    mao_de_obra = MDOSerializer(many=True, read_only=True)
    terceirizados = ServicosTerceirizadosSerializer(many=True, read_only=True)
    atividades = Ativ_previstaSerializer(many=True, read_only=True)

    # --- ESCRITA (POST) ---
    levantamento_id = serializers.PrimaryKeyRelatedField(
        queryset=Levantamento.objects.all(),
        source='levantamento',
        write_only=True
    )
    # Permite enviar os dados do resumo dentro deste campo no POST
    resumo_input = Resumo_orcamentoSerializer(source='resumo', write_only=True)

    class Meta:
        model = Orcamento
        fields = [
            'id', 'levantamento', 'levantamento_id', 
            'resumo', 'resumo_input', 'Observacoes_setor_orcamento',
            'materiais', 'mao_de_obra', 'terceirizados', 'atividades'
        ]

    def create(self, validated_data):
        # 1. Extrai os dados do resumo (pop remove do dicionário original)
        resumo_data = validated_data.pop('resumo')
        
        # 2. Cria o objeto Resumo primeiro (obrigatório para a FK do Orçamento)
        resumo_obj = Resumo_orcamento.objects.create(**resumo_data)
        
        # 3. Cria o Orçamento vinculando o resumo recém-criado
        orcamento = Orcamento.objects.create(resumo=resumo_obj, **validated_data)
        
        return orcamento
    

#Código original
# class OrcamentoSerializer(serializers.ModelSerializer):
#     levantamento = serializers.PrimaryKeyRelatedField(
#         queryset=Levantamento.objects.all()
#     )
#     resumo = Resumo_orcamentoSerializer(read_only=True)
    
#     # These match the 'related_name' in your models
#     materiais = MaterialSerializer(many=True, read_only=True)
#     mao_de_obra = MDOSerializer(many=True, read_only=True)
#     terceirizados = ServicosTerceirizadosSerializer(many=True, read_only=True)
#     atividades = Ativ_previstaSerializer(many=True, read_only=True)

#     class Meta:
#         model = Orcamento
#         fields = '__all__'


# --------------------- Ordem de Servico (OS) ---------------------

class OrdenServicoSerializer(serializers.ModelSerializer):
    # Detalhes dos relacionamentos (leitura)
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    negocio_detalhes = NegocioSerializer(source='negocio', read_only=True)
    
    # Chaves para relacionamentos (escrita)
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
            'a_ser_incluido', 'mao_obra',
            'status_os', 'status_envio', 'status_aprovacao',
            'data_aprovacao', 'documento_assinatura_aprovacao',
            'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'numero_os', 'data_emissao', 'created_at', 'updated_at')
    
    def create(self, validated_data):
        """
        Cria uma nova OrdenServico, gerando um número único automaticamente
        """
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
#------------------------------------------------------------------

class PlanilhasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Planilhas
        fields = '__all__'

class EscopoSerializer(serializers.ModelSerializer):
    # Get all related spreadsheets
    escopo_planilhas = PlanilhasSerializer(many=True, read_only=True)
    
    # Display service details in reads
    tipo_detalhes = ServicoSerializer(source='tipo', read_only=True)
    
    class Meta:
        model = Escopo
        fields = '__all__'

class PropostaComercialSerializer(serializers.ModelSerializer):
    # Relationship reads
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    negocio_detalhes = NegocioSerializer(source='negocio', read_only=True)
    proposta_escopo = EscopoSerializer(many=True, read_only=True)
    
    # Relationship writes
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
        model = PropostaComercial
        fields = [
            'id', 'data_criacao', 
            'cliente', 'cliente_id', 'cliente_detalhes',
            'negocio', 'negocio_id', 'negocio_detalhes',
            'referencia', 'saudacao', 'assunto', 'texto_de_abertura',
            'responsabilidade_contratada', 'responsabilidade_contratante',
            'preco', 'condicoes_gerais', 'condicoes_pagamento', 'prazo',
            'encerramento', 'proposta_escopo'
        ]
        read_only_fields = ('id', 'data_criacao')

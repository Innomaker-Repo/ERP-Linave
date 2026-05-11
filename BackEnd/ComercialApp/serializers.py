from rest_framework import serializers
from .models import (
    Cliente, Negocio, Servico, User,
    Levantamento, MDO, Ativ_prevista, Material, 
    Servico_terceirizado, Orcamento, Resumo_orcamento
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
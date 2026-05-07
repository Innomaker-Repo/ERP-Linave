from rest_framework import serializers
from .models import Cliente, Negocio, Servico, User
from .models import Levantamento, MDO, Ativ_prevista, Material, Servico_terceirizado,Orcamento, Resumo_orcamento 


#----------------- Core ------------------

class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'

class NegocioSerializer(serializers.ModelSerializer):
    servicos = ServicoSerializer(many=True, read_only=True)

    class Meta:
        model = Negocio
        fields = '__all__'

class ClienteSerializer(serializers.ModelSerializer):
    negocios = NegocioSerializer(many=True, read_only=True)

    class Meta:
        model = Cliente
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

#------------------  Orçamento  -------------------

class LevantamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Levantamento
        fields = '__all__'

class MDOSerializer(serializers.ModelSerializer):
    class Meta:
        model = MDO
        fields = '__all__'

class Ativ_previstaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ativ_prevista
        fields = '__all__'

class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = '__all__'

class Servicos_terceirizadosSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico_terceirizado
        fields = '__all__'

class Resumo_orcamentoSerializer(serializers.ModelSerializer):
    MDOs = MDOSerializer(many=True, read_only=True)
    Mats = MaterialSerializer(many=True, read_only=True)
    SRVs = Servicos_terceirizadosSerializer(many=True, read_only=True)
    
    class Meta:
        model = Resumo_orcamento
        fields = '__all__'

class OrcamentoSerializer(serializers.ModelSerializer):
    # These let you see the full data instead of just IDs
    levantamento = LevantamentoSerializer(read_only=True)
    resumo = Resumo_orcamentoSerializer(read_only=True)
    
    # These bring the "Lists of N" into the view
    materiais = MaterialSerializer(many=True, read_only=True)
    mao_de_obra = MDOSerializer(many=True, read_only=True)

    class Meta:
        model = Orcamento
        fields = '__all__'
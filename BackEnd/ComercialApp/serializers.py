from rest_framework import serializers
from .models import Cliente, Negocio, Servico, User
from .models import Levantamento, MDO, Ativ_previstas, Materiais, Servicos_terceirizados, Observacoes_setor_orcamento, Resumo_orcamento 


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

class Ativ_previstasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ativ_previstas
        fields = '__all__'

class MateriaisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Materiais
        fields = '__all__'

class Servicos_terceirizadosSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servicos_terceirizados
        fields = '__all__'

class Observacoes_setor_orcamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observacoes_setor_orcamento
        fields = '__all__'

class Resumo_orcamentoSerializer(serializers.ModelSerializer):
    MDOs = MDOSerializer(many=True, read_only=True)
    Mats = MateriaisSerializer(many=True, read_only=True)
    SRVs = Servicos_terceirizadosSerializer(many=True, read_only=True)
    
    class Meta:
        model = Resumo_orcamento
        fields = '__all__'
    
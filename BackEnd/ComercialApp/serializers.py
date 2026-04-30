from rest_framework import serializers
from .models import Cliente, Negocio, Servico, User

class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'

class NegocioSerializer(serializers.ModelSerializer):
    # 'servicos' é o related_name definido no model Servico
    servicos = ServicoSerializer(many=True, read_only=True)
    
    # 'cliente' vai trazer o objeto completo do cliente em vez de só o ID
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=False)

    class Meta:
        model = Negocio
        fields = '__all__'
     
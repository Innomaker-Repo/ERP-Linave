from rest_framework import serializers
from .models import Cliente, Negocio, Servico, User

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
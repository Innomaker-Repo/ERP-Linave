from django.shortcuts import render

from requests import Response
from rest_framework import viewsets
from .models import Cliente, Negocio, Servico, User
from .serializers import ClienteSerializer, NegocioSerializer, ServicoSerializer, UserSerializer

from rest_framework.decorators import api_view
from rest_framework import status
from django.db import transaction


class NegocioViewSet(viewsets.ModelViewSet):
    queryset = Negocio.objects.all()
    serializer_class = NegocioSerializer


@api_view(['POST'])
def cadastrar_negocio_completo(request):
    # Usamos atomic para que ou salve TUDO ou não salve NADA
    with transaction.atomic():
        # 1. Validar e salvar o Negócio
        negocio_serializer = NegocioSerializer(data=request.data.get('negocio'))
        if negocio_serializer.is_valid():
            negocio_instancia = negocio_serializer.save()
            
            # 2. Preparar os dados do Serviço vinculando ao Negócio criado
            servico_data = request.data.get('servico')
            servico_data['negocio'] = negocio_instancia.id # Vincula a FK automaticamente
            
            servico_serializer = ServicoSerializer(data=servico_data)
            
            if servico_serializer.is_valid():
                servico_serializer.save()
                return Response({
                    "message": "Negócio e Serviço cadastrados com sucesso!",
                    "negocio_id": negocio_instancia.id
                }, status=status.HTTP_201_CREATED)
            else:
                # Se o serviço for inválido, o 'atomic' cancela o negócio acima
                return Response(servico_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(negocio_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

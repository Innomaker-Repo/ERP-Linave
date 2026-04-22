from django.shortcuts import render

from rest_framework.response import Response
from rest_framework import viewsets
from .models import Cliente, Negocio, Servico, User, Levantamento, MDO, Ativ_previstas, Materiais, Servicos_terceirizados, Observacoes_setor_orcamento, Resumo_orcamento
from .serializers import ClienteSerializer, NegocioSerializer, ServicoSerializer, UserSerializer, LevantamentoSerializer, MDOSerializer, Ativ_previstasSerializer, MateriaisSerializer, Servicos_terceirizadosSerializer, Observacoes_setor_orcamentoSerializer, Resumo_orcamentoSerializer


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

# ...ação: criar uma entrada orçamento...

class OrcamentoViewSet(viewsets.ModelViewSet):
    queryset = Levantamento.objects.all()   
    serializer_class = LevantamentoSerializer  # Fixed typo
    
@api_view(['POST'])
def criar_orcamento(request):
    """
    POST request expects:
    {
        "levantamento": { ...levantamento fields... },
        "resumo": { ...resumo_orcamento fields... }
    }
    Returns combined data with total cost.
    """
    with transaction.atomic():
        # 1. Create Levantamento
        levantamento_data = request.data.get('levantamento')
        levantamento_serializer = LevantamentoSerializer(data=levantamento_data)
        
        if not levantamento_serializer.is_valid():
            return Response(levantamento_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        levantamento_instance = levantamento_serializer.save()
        
        # 2. Create Resumo_orcamento linked to Levantamento
        resumo_data = request.data.get('resumo')
        resumo_data['credenciais'] = levantamento_instance.id_orcamento  # Link to Levantamento
        
        resumo_serializer = Resumo_orcamentoSerializer(data=resumo_data)
        
        if not resumo_serializer.is_valid():
            return Response(resumo_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        resumo_instance = resumo_serializer.save()
        
        # 3. Return combined response with total cost
        return Response({
            "message": "Orçamento criado com sucesso!",
            "levantamento_id": levantamento_instance.id_orcamento,
            "resumo_id": resumo_instance.id,
            "custo_final": str(resumo_instance.custo_final),
            "levantamento": levantamento_serializer.data,
            "resumo": resumo_serializer.data
        }, status=status.HTTP_201_CREATED)
    #resultado final são 2 entradas separadas, mas vinculadas entre si, e a resposta da API inclui os dados de ambas e o custo final calculado. Se qualquer parte falhar, nada é salvo no banco. Uma contem dados de abertura, a outra os dados economicos.
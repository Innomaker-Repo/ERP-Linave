from django.shortcuts import render

from rest_framework.response import Response
from rest_framework import viewsets
from .models import Cliente, Negocio, Servico, User, Levantamento, MDO, Ativ_prevista, Material, Servico_terceirizado, Resumo_orcamento, Orcamento
from .serializers import ClienteSerializer, NegocioSerializer, ServicoSerializer, UserSerializer, LevantamentoSerializer, MDOSerializer, Ativ_previstaSerializer, MaterialSerializer, Servicos_terceirizadosSerializer, OrcamentoSerializer, Resumo_orcamentoSerializer


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
    queryset = Orcamento.objects.all()   
    serializer_class = OrcamentoSerializer 

@api_view(['POST'])
def criar_orcamento(request):
    """
    Expects JSON:
    {
        "levantamento": { ... },
        "resumo": { ... },
        "observacoes": "Texto opcional"
    }
    """
    with transaction.atomic():
        # 1. Handle Levantamento
        lev_data = request.data.get('levantamento')
        lev_serializer = LevantamentoSerializer(data=lev_data)
        if not lev_serializer.is_valid():
            return Response({"error": "Levantamento inválido", "details": lev_serializer.errors}, status=400)
        levantamento_instance = lev_serializer.save()

        # 2. Handle Resumo
        resumo_data = request.data.get('resumo')
        res_serializer = Resumo_orcamentoSerializer(data=resumo_data)
        if not res_serializer.is_valid():
            # Rollback triggered automatically by transaction.atomic()
            return Response({"error": "Resumo inválido", "details": res_serializer.errors}, status=400)
        resumo_instance = res_serializer.save()

        # 3. Create the Parent 'Orcamento' to join them
        orcamento_instance = Orcamento.objects.create(
            levantamento=levantamento_instance,
            resumo=resumo_instance,
            Observacoes_setor_orcamento=request.data.get('observacoes', '')
        )

        # 4. Return combined data
        return Response({
            "message": "Orçamento centralizado criado com sucesso!",
            "orcamento_id": orcamento_instance.id,
            "levantamento_id": levantamento_instance.id_orcamento,
            "resumo_id": resumo_instance.id,
            "custo_total": str(resumo_instance.custo_com_impostos), # Using our property
            "custo_unitario": str(resumo_instance.custo_por_unidade)
        }, status=status.HTTP_201_CREATED)
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
from .models import (
    Cliente, Negocio, Servico,
    Levantamento, MDO, Material, Servico_terceirizado, Orcamento, Ativ_prevista, Resumo_orcamento,
    OrdemServico, Escopo, PropostaComercial, Fornecedor, Medicao, Documento
)
from .serializers import (
    ClienteSerializer, NegocioSerializer, ServicoSerializer,
    OrcamentoSerializer, OrdemServicoSerializer, EscopoSerializer,
    PropostaComercialSerializer, FornecedorSerializer, MedicaoSerializer,
    DocumentoSerializer
)

# --- ViewSets Básicos ---
class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        print(serializer.errors)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class FornecedorViewSet(viewsets.ModelViewSet):
    queryset = Fornecedor.objects.all()
    serializer_class = FornecedorSerializer

#NEGÓCIOS
# --- ViewSet de Negócio com Lógica Customizada ---  
class NegocioViewSet(viewsets.ModelViewSet):
    
    queryset = Negocio.objects.select_related('cliente').prefetch_related('servicos').all()
    serializer_class = NegocioSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # 1. Work on a mutable copy so we can pop without touching the original
        data = request.data.copy()
        servicos_data = data.pop('servicos', [])

        # 2. Ensure tipo_servico has a safe fallback value
        if 'tipo_servico' not in data:
            data['tipo_servico'] = servicos_data[0].get('tipo', 'Não informado') if servicos_data else 'Não informado'

        # 3. Save the Negocio (without servicos — they're handled separately)
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        negocio = serializer.save()

        servicos_objs = []
        for servico in servicos_data:
            servico['negocio'] = negocio.pk
            s_serializer = ServicoSerializer(data=servico)
            s_serializer.is_valid(raise_exception=True)
            s_serializer.save()
            servicos_objs.append(s_serializer.data)

        return Response({"negocio": serializer.data, "servicos": servicos_objs}, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        # partial=True permite que apenas alguns campos sejam atualizados (ex: status)
        partial = kwargs.pop('partial', True) 
        instance = self.get_object()
        
        # Só lida com serviços se a lista vier explicitamente e não for vazia
        servicos_data = request.data.pop('servicos', None)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Se houver uma nova lista de serviços, substitua os antigos
        if servicos_data is not None:
            instance.servicos.all().delete()
            for servico in servicos_data:
                servico['negocio'] = instance.id
                s_serializer = ServicoSerializer(data=servico)
                s_serializer.is_valid(raise_exception=True)
                s_serializer.save()
                
        return Response(serializer.data)
    
#ORÇAMENTOS
# --- Funções Customizadas ---
@api_view(['POST'])
def criar_orcamento(request):
    with transaction.atomic():
        # 1. Levantamento
        lev_data = request.data.get('levantamento')
        if not isinstance(lev_data, dict):
            return Response(
                {'error': 'Dados de levantamento ausentes ou inválidos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cliente_id = lev_data.get('cliente_id') or lev_data.get('cliente')
        negocio_id = lev_data.get('negocio_id') or lev_data.get('negocio')

        if not negocio_id:
            return Response({'error': 'negocio_id é obrigatório no levantamento.'}, status=status.HTTP_400_BAD_REQUEST)

        levantamento_instance, _ = Levantamento.objects.get_or_create(
            negocio_id=negocio_id,
            defaults={'cliente_id': cliente_id, 'negocio_id': negocio_id}
        )

        numero_orcamento = request.data.get('numeroOrcamento') or request.data.get('numero_orcamento') or ''
        versao = request.data.get('versao', '')
        status_orcamento = request.data.get('status', 'pendente')
        data_criacao = request.data.get('dataCriacao') or request.data.get('data_criacao')
        data_recusa = request.data.get('dataRecusa') or request.data.get('data_recusa')
        resumo_data = request.data.get('resumo') or {}

        # 2. Orçamento Pai — criado ANTES do Resumo (FK aponta de Resumo para Orcamento)
        orcamento_instance = Orcamento.objects.filter(levantamento=levantamento_instance).first()

        if orcamento_instance:
            orcamento_instance.numero_orcamento = numero_orcamento or orcamento_instance.numero_orcamento
            orcamento_instance.versao = versao or orcamento_instance.versao
            orcamento_instance.status = status_orcamento or orcamento_instance.status
            if data_criacao:
                orcamento_instance.data_criacao = data_criacao
            if data_recusa:
                orcamento_instance.data_recusa = data_recusa
            orcamento_instance.observacoes_setor_orcamento = request.data.get('observacoes', '')
            orcamento_instance.save()
        else:
            create_kwargs = {
                'levantamento': levantamento_instance,
                'observacoes_setor_orcamento': request.data.get('observacoes', ''),
                'numero_orcamento': numero_orcamento,
                'versao': versao,
                'status': status_orcamento,
            }
            if data_criacao:
                create_kwargs['data_criacao'] = data_criacao
            if data_recusa:
                create_kwargs['data_recusa'] = data_recusa
            orcamento_instance = Orcamento.objects.create(**create_kwargs)

        # 3. Resumo — criado/atualizado DEPOIS do Orçamento
        resumo_defaults = {
            'margem': resumo_data.get('margem', 0),
            'OH': resumo_data.get('OH', resumo_data.get('oh', 0)),
            'impostos': resumo_data.get('impostos', 0),
            'qnt': resumo_data.get('qnt', resumo_data.get('quantidadeItensProduzidos', 1)),
        }
        resumo_instance = getattr(orcamento_instance, 'resumo', None)
        if resumo_instance:
            for field, value in resumo_defaults.items():
                setattr(resumo_instance, field, value)
            resumo_instance.save()
        else:
            Resumo_orcamento.objects.create(orcamento=orcamento_instance, **resumo_defaults)

        # 4. Limpeza e recriação dos itens
        orcamento_instance.mao_de_obra.all().delete()
        orcamento_instance.materiais.all().delete()
        orcamento_instance.terceirizados.all().delete()
        orcamento_instance.atividades.all().delete()

        for item in request.data.get('mao_de_obra', []):
            safe = {k: v for k, v in item.items() if k not in ('id', 'orcamento')}
            MDO.objects.create(orcamento=orcamento_instance, **safe)
        for item in request.data.get('materiais', []):
            safe = {k: v for k, v in item.items() if k not in ('id', 'orcamento')}
            Material.objects.create(orcamento=orcamento_instance, **safe)
        for item in request.data.get('terceirizados', []):
            safe = {k: v for k, v in item.items() if k not in ('id', 'orcamento')}
            Servico_terceirizado.objects.create(orcamento=orcamento_instance, **safe)
        for item in request.data.get('atividades', []):
            safe = {k: v for k, v in item.items() if k not in ('id', 'orcamento')}
            if 'duração' in safe and 'duracao' not in safe:
                safe['duracao'] = safe.pop('duração')
            Ativ_prevista.objects.create(orcamento=orcamento_instance, **safe)

        finalizar = request.data.get('finalizar', False)
        if isinstance(finalizar, str):
            finalizar = finalizar.lower() in ['true', '1', 'yes', 'y']

        if finalizar and negocio_id:
            try:
                negocio_vinculado = Negocio.objects.get(id=negocio_id)
                negocio_vinculado.orcamento_realizado = True
                negocio_vinculado.requer_reorcamento = False
                negocio_vinculado.save(update_fields=['orcamento_realizado', 'requer_reorcamento'])
            except Negocio.DoesNotExist:
                pass

        orcamento_instance.refresh_from_db()
        response_data = {
            "message": "Orçamento finalizado com sucesso!" if finalizar else "Orçamento salvo com sucesso!",
            "orcamento_id": orcamento_instance.id,
            "orcamento": OrcamentoSerializer(orcamento_instance).data
        }
        return Response(response_data, status=status.HTTP_200_OK)


# --------------------- Ordem de Servico (OS) ---------------------

class OrdemServicoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar Ordens de Servico (OS)
    Operações: CREATE, READ, UPDATE, DELETE
    """
    queryset = OrdemServico.objects.select_related('cliente', 'negocio').all()
    serializer_class = OrdemServicoSerializer
    
    def list(self, request, *args, **kwargs):
        """
        Listar todas as OS com filtros opcionais
        Filtros: cliente_id, negocio_id, status_os, status_envio, status_aprovacao
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        # Filtros opcionais
        cliente_id = request.query_params.get('cliente')
        negocio_id = request.query_params.get('negocio')
        status_os = request.query_params.get('status_os')
        status_envio = request.query_params.get('status_envio')
        status_aprovacao = request.query_params.get('status_aprovacao')
        
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)
        if negocio_id:
            queryset = queryset.filter(negocio_id=negocio_id)
        if status_os:
            queryset = queryset.filter(status_os=status_os)
        if status_envio:
            queryset = queryset.filter(status_envio=status_envio)
        if status_aprovacao:
            queryset = queryset.filter(status_aprovacao=status_aprovacao)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Criar uma nova Ordem de Servico
        Campos obrigatórios: cliente, local, supervisor_encarregado, descricao_geral_servico
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        return Response(
            {
                "message": "Ordem de Servico criada com sucesso!",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )
    
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """
        Atualizar uma Ordem de Servico existente
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(
            {
                "message": "Ordem de Servico atualizada com sucesso!",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )
    
    def destroy(self, request, *args, **kwargs):
        """
        Deletar uma Ordem de Servico
        """
        instance = self.get_object()
        numero_os = instance.numero_os
        self.perform_destroy(instance)
        
        return Response(
            {"message": f"Ordem de Servico {numero_os} deletada com sucesso!"},
            status=status.HTTP_204_NO_CONTENT
        )


@api_view(['GET', 'POST', 'PUT'])
def configuracoes_data(request):
    """Configurações da empresa + listas auxiliares (singleton).

    GET  -> {'config': {...}, 'listas': {...}}
    POST/PUT -> recebe {'config'?: {...}, 'listas'?: {...}} e substitui o(s) que vier.
    """
    from .models import ConfiguracaoApp

    inst = ConfiguracaoApp.objects.first()

    if request.method == 'GET':
        return Response(
            {
                'config': (inst.config if inst and isinstance(inst.config, dict) else None),
                'listas': (inst.listas if inst and isinstance(inst.listas, dict) else None),
            },
            status=status.HTTP_200_OK,
        )

    payload = request.data if isinstance(request.data, dict) else {}
    if inst is None:
        inst = ConfiguracaoApp.objects.create()
    if 'config' in payload and isinstance(payload['config'], dict):
        inst.config = payload['config']
    if 'listas' in payload and isinstance(payload['listas'], dict):
        inst.listas = payload['listas']
    inst.save()

    return Response({'config': inst.config, 'listas': inst.listas}, status=status.HTTP_200_OK)


@api_view(['GET', 'POST', 'PUT'])
def alocacoes_data(request):
    """Estado das Alocações (funcionário ↔ obra/OS).

    GET  -> lista de alocações (registro completo via `extra`).
    POST/PUT -> recebe a lista completa e substitui (replace-all).
    """
    from .models import Alocacao
    from django.db import transaction

    if request.method == 'GET':
        return Response([
            (a.extra if isinstance(a.extra, dict) else {}) for a in Alocacao.objects.all()
        ], status=status.HTTP_200_OK)

    payload = request.data
    if isinstance(payload, dict):
        payload = payload.get('alocacoes', payload.get('data', []))
    if not isinstance(payload, list):
        return Response({'error': 'Esperado um array de alocações.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        Alocacao.objects.all().delete()
        seen = set()
        instances = []
        for rec in payload:
            if not isinstance(rec, dict):
                continue
            rid = str(rec.get('id') or '').strip()
            if not rid or rid in seen:
                continue
            seen.add(rid)
            instances.append(Alocacao(
                record_id=rid,
                funcionario_id=str(rec.get('funcionarioId') or '')[:120],
                obra_id=(str(rec.get('obraId'))[:120] if rec.get('obraId') else None),
                os_id=(str(rec.get('osId'))[:120] if rec.get('osId') else None),
                data_inicio=str(rec.get('dataInicio') or '')[:20],
                data_fim=(str(rec.get('dataFim'))[:20] if rec.get('dataFim') else None),
                status=str(rec.get('status') or 'Ativa')[:30],
                extra=rec,
            ))
        Alocacao.objects.bulk_create(instances)

    return Response([
        (a.extra if isinstance(a.extra, dict) else {}) for a in Alocacao.objects.all()
    ], status=status.HTTP_200_OK)


@api_view(['GET', 'POST', 'PUT'])
def almoxarifado_data(request):
    """Estado do Estoque/Almoxarifado (objeto agregado único).

    GET  -> objeto de almoxarifado (ou null se ainda não existir).
    POST/PUT -> recebe o objeto completo e substitui o agregado (singleton).
    """
    from .almox_sync import read as almox_read, replace as almox_replace

    if request.method == 'GET':
        return Response(almox_read(), status=status.HTTP_200_OK)

    payload = request.data
    if isinstance(payload, dict) and set(payload.keys()) == {'data'}:
        payload = payload.get('data')
    return Response(almox_replace(payload if isinstance(payload, dict) else {}), status=status.HTTP_200_OK)


@api_view(['GET', 'POST', 'PUT'])
def financeiro_data(request):
    """Estado financeiro como lista unificada de FinRecord.

    GET  -> retorna todos os registros (Banco, Solicitação, Conta a Pagar, NFe,
            Conta a Receber, Locação) no formato que o frontend (useFin) consome.
    POST/PUT -> recebe a lista completa de FinRecord e substitui todo o estado
            (espelha o comportamento antigo do blob, que reescrevia tudo).
    """
    from .financeiro_sync import read_all, replace_all

    if request.method == 'GET':
        return Response(read_all(), status=status.HTTP_200_OK)

    payload = request.data
    if isinstance(payload, dict):
        payload = payload.get('financeiro', payload.get('data', []))
    if not isinstance(payload, list):
        return Response({'error': 'Esperado um array de registros financeiros.'}, status=status.HTTP_400_BAD_REQUEST)

    total = replace_all(payload)
    return Response({'message': 'Financeiro sincronizado.', 'total': total, 'financeiro': read_all()}, status=status.HTTP_200_OK)


@api_view(['GET', 'POST', 'PUT'])
def compras_data(request):
    """Estado de Compras (requisições do kanban + histórico de compras concluídas).

    GET  -> {'compras': [...requisições...], 'comprasHistorico': [...histórico...]}
    POST/PUT -> recebe {'compras'?: [...], 'comprasHistorico'?: [...]} e substitui
            (replace-all) apenas a(s) coleção(ões) presente(s) no corpo.
    """
    from .compras_sync import read_requisicoes, read_historico, replace_requisicoes, replace_historico

    if request.method == 'GET':
        return Response(
            {'compras': read_requisicoes(), 'comprasHistorico': read_historico()},
            status=status.HTTP_200_OK,
        )

    payload = request.data if isinstance(request.data, dict) else {}
    if 'compras' in payload:
        replace_requisicoes(payload.get('compras') or [])
    if 'comprasHistorico' in payload:
        replace_historico(payload.get('comprasHistorico') or [])

    return Response(
        {'compras': read_requisicoes(), 'comprasHistorico': read_historico()},
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
def ordens_servico_por_cliente(request, cliente_id):
    """
    Endpoint customizado para buscar todas as OS de um cliente específico
    GET /api/os-por-cliente/<cliente_id>/
    """
    try:
        cliente = Cliente.objects.get(id=cliente_id)
        ordens_servico = OrdemServico.objects.filter(cliente=cliente).order_by('-created_at')
        
        serializer = OrdemServicoSerializer(ordens_servico, many=True)
        return Response(
            {
                "cliente": ClienteSerializer(cliente).data,
                "ordens_servico": serializer.data,
                "total": ordens_servico.count()
            },
            status=status.HTTP_200_OK
        )
    except Cliente.DoesNotExist:
        return Response(
            {"error": "Cliente não encontrado"},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def ordens_servico_por_negocio(request, negocio_id):
    """
    Endpoint customizado para buscar todas as OS de um negócio específico
    GET /api/os-por-negocio/<negocio_id>/
    """
    try:
        negocio = Negocio.objects.get(id=negocio_id)
        ordens_servico = OrdemServico.objects.filter(negocio=negocio).order_by('-created_at')
        
        serializer = OrdemServicoSerializer(ordens_servico, many=True)
        return Response(
            {
                "negocio": NegocioSerializer(negocio).data,
                "ordens_servico": serializer.data,
                "total": ordens_servico.count()
            },
            status=status.HTTP_200_OK
        )
    except Negocio.DoesNotExist:
        return Response(
            {"error": "Negócio não encontrado"},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['PATCH'])
def atualizar_status_os(request, pk):
    """
    Endpoint para atualizar apenas o status de uma OS
    PATCH /api/os/<id>/atualizar-status/
    Payload: {
        "status_os": "emproducao" | "concluida",
        "status_envio": "pendente" | "enviada",
        "status_aprovacao": "pendente" | "aprovada"
    }
    """
    try:
        ordem_servico = OrdemServico.objects.get(id=pk)
        
        # Atualizar status se fornecido
        if 'status_os' in request.data:
            ordem_servico.status_os = request.data['status_os']
        if 'status_envio' in request.data:
            ordem_servico.status_envio = request.data['status_envio']
        if 'status_aprovacao' in request.data:
            ordem_servico.status_aprovacao = request.data['status_aprovacao']
            if request.data['status_aprovacao'] == 'aprovada':
                from django.utils import timezone
                ordem_servico.data_aprovacao = timezone.now().date()
        
        ordem_servico.save()
        
        serializer = OrdemServicoSerializer(ordem_servico)
        return Response(
            {
                "message": "Status da OS atualizado com sucesso!",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )
    except OrdemServico.DoesNotExist:
        return Response(
            {"error": "Ordem de Servico não encontrada"},
            status=status.HTTP_404_NOT_FOUND
        )


class PropostaComercialViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar Propostas Comerciais
    """
    queryset = PropostaComercial.objects.select_related('cliente', 'negocio').prefetch_related('proposta_escopo').all()
    serializer_class = PropostaComercialSerializer
    
    def list(self, request, *args, **kwargs):
        """
        Listar propostas com filtros opcionais
        Filtros: cliente_id, negocio_id
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        cliente_id = request.query_params.get('cliente')
        negocio_id = request.query_params.get('negocio')
        
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)
        if negocio_id:
            queryset = queryset.filter(negocio_id=negocio_id)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Criar nova proposta comercial com escopos opcionais
        """
        data = request.data.copy()
        escopos_data = data.pop('proposta_escopo', [])
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        proposta = serializer.save()
        
        escopos_objs = []
        for escopo in escopos_data:
            escopo['proposta_link'] = proposta.id
            e_serializer = EscopoSerializer(data=escopo)
            e_serializer.is_valid(raise_exception=True)
            e_serializer.save()
            escopos_objs.append(e_serializer.data)
        
        return Response({
            "message": "Proposta Comercial criada com sucesso!",
            "proposta": serializer.data,
            "escopos": escopos_objs
        }, status=status.HTTP_201_CREATED)


# --------------------- Medição ---------------------

class MedicaoViewSet(viewsets.ModelViewSet):
    """Medições (por OS). Suporta filtros ?ordem_servico= / ?negocio= / ?status=."""
    queryset = Medicao.objects.select_related('negocio', 'ordem_servico').prefetch_related('itens').all()
    serializer_class = MedicaoSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        os_id = request.query_params.get('ordem_servico')
        negocio_id = request.query_params.get('negocio')
        status_filtro = request.query_params.get('status')
        if os_id:
            queryset = queryset.filter(ordem_servico_id=os_id)
        if negocio_id:
            queryset = queryset.filter(negocio_id=negocio_id)
        if status_filtro:
            queryset = queryset.filter(status=status_filtro)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


# --------------------- Documentos (upload genérico) ---------------------

class DocumentoViewSet(viewsets.ModelViewSet):
    """Upload e recuperação de documentos (genérico, reutilizável).

    - POST  multipart/form-data: campo `arquivo` (binário) + `vinculo_tipo`,
            `vinculo_id`, `categoria`. O binário vai para o disco (MEDIA_ROOT) e a
            linha no banco guarda caminho + metadados.
    - GET   ?vinculo_tipo=&vinculo_id=&categoria= filtra os documentos de um vínculo.
    - DELETE remove o registro (e o arquivo do disco).
    """
    queryset = Documento.objects.all()
    serializer_class = DocumentoSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        vinculo_tipo = params.get('vinculo_tipo')
        vinculo_id = params.get('vinculo_id')
        categoria = params.get('categoria')
        if vinculo_tipo:
            qs = qs.filter(vinculo_tipo=vinculo_tipo)
        if vinculo_id is not None and vinculo_id != '':
            qs = qs.filter(vinculo_id=str(vinculo_id))
        if categoria:
            qs = qs.filter(categoria=categoria)
        return qs

    def perform_create(self, serializer):
        arquivo = self.request.data.get('arquivo')
        nome = getattr(arquivo, 'name', '') or self.request.data.get('nome_original', '')
        tamanho = getattr(arquivo, 'size', 0) or 0
        content_type = getattr(arquivo, 'content_type', '') or self.request.data.get('tipo', '')
        serializer.save(nome_original=nome, tamanho=tamanho, tipo=content_type)

    def perform_destroy(self, instance):
        # Remove também o binário do disco (sem apagar o registro deixaria órfãos).
        instance.arquivo.delete(save=False)
        instance.delete()


@api_view(['PATCH'])
def atualizar_status_medicao(request, pk):
    """Aprova/recusa uma medição. Payload: {status: 'aprovada'|'recusada'|'pendente', motivo_recusa?}."""
    try:
        medicao = Medicao.objects.get(id=pk)
    except Medicao.DoesNotExist:
        return Response({'error': 'Medição não encontrada'}, status=status.HTTP_404_NOT_FOUND)

    novo_status = request.data.get('status')
    if novo_status not in ('pendente', 'aprovada', 'recusada'):
        return Response({'error': 'status inválido'}, status=status.HTTP_400_BAD_REQUEST)

    medicao.status = novo_status
    if novo_status == 'aprovada':
        from django.utils import timezone
        medicao.data_aprovacao = timezone.now().date().isoformat()
    if 'motivo_recusa' in request.data:
        medicao.motivo_recusa = request.data['motivo_recusa'] or ''
    medicao.save()

    return Response(MedicaoSerializer(medicao).data, status=status.HTTP_200_OK)

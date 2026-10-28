from rest_framework import viewsets, status, serializers as drf_serializers
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.exceptions import AuthenticationFailed, Throttled
from rest_framework.throttling import SimpleRateThrottle
from django.db import transaction, DataError, IntegrityError
from django.db.models import Q
from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .media_auth import definir_cookie_media, apagar_cookie_media
from .models import (
    Cliente, Negocio, Servico, ItemAlocacao,
    Levantamento, MDO, Material, Servico_terceirizado, Orcamento, Ativ_prevista, Resumo_orcamento,
    OrdemServico, Escopo, PropostaComercial, TemplateProposta, Fornecedor, Medicao, Documento, User, LogAtividade
)
from .serializers import (
    ClienteSerializer, NegocioSerializer, ServicoSerializer,
    OrcamentoSerializer, OrdemServicoSerializer, EscopoSerializer,
    PropostaComercialSerializer, TemplatePropostaSerializer, FornecedorSerializer, MedicaoSerializer,
    DocumentoSerializer, UserSerializer
)
from .permissions import (
    IsAdmin, permissao_modulo, eh_admin, escreve_em_tudo, tem_permissao_modulo,
    COMERCIAL, PRODUCAO, FINANCEIRO, COMPRAS_GESTAO, SUPRIMENTOS,
)
from .ws_notify import dispatch_collection_changed
from .auth_backends import (
    LOGIN_MAX_TENTATIVAS, LOGIN_AVISO_A_PARTIR_DE, falhas_da_origem, ip_do_cliente, origem_bloqueada,
)


# --- Log de atividades ---
def _registrar_log(request, acao, modulo, descricao=''):
    """Registra uma ação no log. Nunca lança exceção para não quebrar a operação principal."""
    try:
        u = getattr(request, 'user', None)
        if not u or not u.is_authenticated:
            return
        LogAtividade.objects.create(
            usuario_cpf=u.cpf,
            usuario_nome=getattr(u, 'nome', str(u)),
            acao=acao,
            modulo=modulo,
            descricao=str(descricao)[:300],
        )
    except Exception:
        pass


class LogMixin:
    """Mixin para ViewSets: loga criação, atualização e exclusão automaticamente."""
    LOG_MODULO = ''

    def _modulo(self):
        return self.LOG_MODULO or self.__class__.__name__.replace('ViewSet', '')

    def perform_create(self, serializer):
        instance = serializer.save()
        _registrar_log(self.request, 'criacao', self._modulo(), str(instance))

    def perform_update(self, serializer):
        instance = serializer.save()
        _registrar_log(self.request, 'atualizacao', self._modulo(), str(instance))

    def perform_destroy(self, instance):
        _registrar_log(self.request, 'exclusao', self._modulo(), str(instance))
        instance.delete()


# --- Proteção contra força bruta no login ---
# A contagem e o bloqueio em si ficam em auth_backends.py (valem também pro admin do Django).
# Aqui só se monta a mensagem: aviso a partir da LOGIN_AVISO_A_PARTIR_DE-ésima senha errada,
# bloqueio na LOGIN_MAX_TENTATIVAS-ésima.
LOGIN_MSG_INVALIDO = 'CPF/e-mail ou senha inválidos.'
LOGIN_MSG_BLOQUEADO = (
    f'Conta bloqueada após {LOGIN_MAX_TENTATIVAS} tentativas de senha incorreta. '
    'Procure o administrador do sistema para desbloquear.'
)


def _mensagem_por_falhas(falhas, bloqueado=False):
    if bloqueado or falhas >= LOGIN_MAX_TENTATIVAS:
        return LOGIN_MSG_BLOQUEADO
    if falhas >= LOGIN_AVISO_A_PARTIR_DE:
        restantes = LOGIN_MAX_TENTATIVAS - falhas
        return (f'{LOGIN_MSG_INVALIDO} Atenção: {restantes} tentativa(s) restante(s) '
                'antes de a conta ser bloqueada.')
    return LOGIN_MSG_INVALIDO


def _falha_login_inexistente(identifier, request):
    """Contagem "de mentira" (no cache, 24h, por login + IP — igual à de uma conta real) para
    logins que não existem — só pra que a resposta seja indistinguível."""
    import hashlib
    from django.core.cache import cache

    base = f'{identifier.strip().lower()}|{ip_do_cliente(request)}'
    chave = 'login-inexistente:' + hashlib.sha256(base.encode()).hexdigest()
    falhas = (cache.get(chave) or 0) + 1
    cache.set(chave, falhas, 60 * 60 * 24)
    return _mensagem_por_falhas(falhas)


def _mensagem_falha_login(user_obj, request):
    """Mensagem para o usuário depois de uma senha errada (a falha já foi contada pelo
    sinal user_login_failed — ver auth_backends.contar_falha_login). O aviso de "restam N"
    é da origem (IP) de quem está tentando; conta bloqueada por inteiro também vale."""
    user_obj.refresh_from_db(fields=['login_bloqueado'])
    falhas, origem_bloq = falhas_da_origem(user_obj, request)
    return _mensagem_por_falhas(falhas, origem_bloq or user_obj.login_bloqueado)


# --- Login flexível (CPF ou e-mail) ---
class FlexTokenSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['identifier'] = drf_serializers.CharField()
        self.fields.pop('cpf', None)

    def validate(self, attrs):
        identifier = attrs.pop('identifier', '').strip()

        if '@' in identifier:
            user_obj = User.objects.filter(email__iexact=identifier).first()
        else:
            user_obj = User.objects.filter(cpf=identifier).first()

        if user_obj is None:
            # Login inexistente responde EXATAMENTE como um existente (mesmo 401, mesmos
            # avisos de tentativas restantes, mesmo "conta bloqueada" na 5ª) — senão as
            # mensagens revelariam quais CPFs/e-mails têm conta no sistema.
            # Roda um hash de senha à toa, como o ModelBackend do Django faz: sem isso a
            # resposta sairia mais rápido e o TEMPO revelaria que a conta não existe.
            make_password(attrs.get('password') or '')
            mensagem = _falha_login_inexistente(identifier, self.context.get('request'))
            codigo = 'login_bloqueado' if mensagem == LOGIN_MSG_BLOQUEADO else 'credenciais_invalidas'
            raise AuthenticationFailed(mensagem, code=codigo)
        attrs['cpf'] = user_obj.cpf

        # Bloqueada (a conta, ou esta origem para esta conta): nem a senha certa entra até
        # um admin desbloquear.
        if user_obj.login_bloqueado or origem_bloqueada(user_obj, self.context.get('request')):
            raise AuthenticationFailed(LOGIN_MSG_BLOQUEADO, code='login_bloqueado')

        try:
            return super().validate(attrs)
        except AuthenticationFailed:
            mensagem = _mensagem_falha_login(user_obj, self.context.get('request'))
            codigo = 'login_bloqueado' if mensagem == LOGIN_MSG_BLOQUEADO else 'credenciais_invalidas'
            raise AuthenticationFailed(mensagem, code=codigo)


class LoginRateThrottle(SimpleRateThrottle):
    """Limite de tentativas de login por IP (todas as contas somadas). O bloqueio por conta
    não impede alguém de varrer CPFs ou travar várias contas em sequência; isto freia.
    Taxa em settings.LOGIN_THROTTLE_RATE (lida a cada pedido, não congelada no import)."""
    scope = 'login'

    def get_rate(self):
        from django.conf import settings
        return getattr(settings, 'LOGIN_THROTTLE_RATE', '20/min')

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class FlexTokenView(TokenObtainPairView):
    serializer_class = FlexTokenSerializer
    throttle_classes = [LoginRateThrottle]

    def throttled(self, request, wait):
        raise Throttled(wait, detail=(
            f'Muitas tentativas de login a partir desta rede. Aguarde {int(wait or 60)} segundo(s) '
            'e tente novamente.'
        ))

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                identifier = request.data.get('identifier', '').strip()
                if '@' in identifier:
                    user_obj = User.objects.get(email__iexact=identifier)
                else:
                    user_obj = User.objects.get(cpf=identifier)
                LogAtividade.objects.create(
                    usuario_cpf=user_obj.cpf,
                    usuario_nome=getattr(user_obj, 'nome', str(user_obj)),
                    acao='login',
                    modulo='Sistema',
                    descricao='Login realizado com sucesso.',
                )
            except Exception:
                pass
            definir_cookie_media(response, response.data.get('access', ''))
        return response


class MediaCookieTokenRefreshView(TokenRefreshView):
    """/token/refresh/ que também renova o cookie de download dos anexos (ver media_auth)."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            definir_cookie_media(response, response.data.get('access', ''))
        return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sessao_media_cookie(request):
    """(Re)grava o cookie de anexos a partir do Bearer atual — pra sessões que já estavam
    abertas antes do cookie existir, chamado pelo frontend ao restaurar a sessão."""
    return definir_cookie_media(Response(status=status.HTTP_204_NO_CONTENT), str(request.auth))


@api_view(['POST'])
@authentication_classes([])  # token vencido no header não pode impedir o logout
@permission_classes([AllowAny])
def sessao_logout(request):
    """Apaga o cookie de anexos no logout (o JWT em si vive no localStorage do frontend)."""
    return apagar_cookie_media(Response(status=status.HTTP_204_NO_CONTENT))


# --- Usuários ---
class UserViewSet(LogMixin, viewsets.ModelViewSet):
    """Gestão de usuários — exclusiva de admin, com UMA exceção: cada usuário pode
    editar o próprio cadastro pela tela "Meu Perfil" (PerfilView).

    Nesse autoatendimento só passam `email` e `password`: `role`, `permissoes` e
    `is_active` são descartados, senão qualquer usuário se promoveria a admin
    com um PATCH no próprio CPF.
    """
    queryset = User.objects.all().order_by('nome')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    LOG_MODULO = 'Usuários'
    # CPF é a PK e vem com pontos/traço ("111.222.333-44"); o regex padrão do router
    # não casa com pontos e devolvia 404 até no "Meu Perfil".
    lookup_value_regex = '[^/]+'

    # Campos que o usuário comum pode mudar em si mesmo.
    CAMPOS_AUTOATENDIMENTO = {'email', 'password'}

    def _e_o_proprio(self, request):
        alvo = self.kwargs.get(self.lookup_field or 'pk')
        return alvo is not None and str(alvo) == str(getattr(request.user, 'cpf', ''))

    def check_permissions(self, request):
        super().check_permissions(request)
        if eh_admin(request.user):
            return
        # Único caso liberado ao não-admin: editar o próprio registro.
        if self.action in ('retrieve', 'update', 'partial_update') and self._e_o_proprio(request):
            return
        self.permission_denied(request, message='Apenas administradores podem gerenciar usuários.')

    def update(self, request, *args, **kwargs):
        if not eh_admin(request.user):
            proibidos = set(request.data.keys()) - self.CAMPOS_AUTOATENDIMENTO
            if proibidos:
                return Response(
                    {'detail': f"Você só pode alterar {', '.join(sorted(self.CAMPOS_AUTOATENDIMENTO))} "
                               f"no próprio perfil. Campos recusados: {', '.join(sorted(proibidos))}."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_superuser:
            return Response({'detail': 'Não é possível excluir o administrador principal.'},
                            status=status.HTTP_403_FORBIDDEN)
        if str(instance.cpf) == str(getattr(request.user, 'cpf', '')):
            return Response({'detail': 'Você não pode excluir a própria conta.'},
                            status=status.HTTP_403_FORBIDDEN)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usuario_me(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

# --- ViewSets Básicos ---
class ClienteViewSet(LogMixin, viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = [permissao_modulo(*COMERCIAL, *FINANCEIRO)]
    LOG_MODULO = 'Clientes'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            instance = serializer.save()
            _registrar_log(request, 'criacao', self.LOG_MODULO, str(instance))
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class FornecedorViewSet(LogMixin, viewsets.ModelViewSet):
    queryset = Fornecedor.objects.all()
    serializer_class = FornecedorSerializer
    permission_classes = [permissao_modulo(*COMPRAS_GESTAO, *FINANCEIRO)]
    LOG_MODULO = 'Fornecedores'

#NEGÓCIOS
# --- ViewSet de Negócio com Lógica Customizada ---  
class NegocioViewSet(LogMixin, viewsets.ModelViewSet):

    queryset = Negocio.objects.select_related('cliente').prefetch_related('servicos').all()
    serializer_class = NegocioSerializer
    permission_classes = [permissao_modulo(*COMERCIAL, *PRODUCAO)]
    LOG_MODULO = 'Negócios'

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
        _registrar_log(request, 'criacao', self.LOG_MODULO, str(negocio))

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
        # perform_update (LogMixin) já grava o log de 'atualizacao'. NÃO chamar _registrar_log
        # aqui de novo, senão cada PATCH/PUT de Negócio gera DOIS registros no LogAtividade.
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
    
# Renomeia uma empresa prestadora (Linave/Servinave/...) em cascata: atualiza de uma vez
# TODOS os negócios e medições já criados que guardam o nome antigo (são campos de texto
# copiados na criação, não uma referência a um cadastro central — por isso precisam ser
# reescritos explicitamente aqui). Ordem de Serviço e Orçamento/Proposta não têm campo de
# empresa próprio: eles exibem a empresa lendo do negócio vinculado, então já acompanham
# a mudança sem precisar de nenhum update adicional.
@api_view(['POST'])
@permission_classes([IsAdmin])
def renomear_empresa_prestadora(request):
    de = str(request.data.get('de') or '').strip()
    para = str(request.data.get('para') or '').strip()
    if not de or not para:
        return Response({'error': 'Informe "de" e "para".'}, status=status.HTTP_400_BAD_REQUEST)
    if de == para:
        return Response({'negocios_atualizados': 0, 'medicoes_atualizadas': 0})

    with transaction.atomic():
        negocios_atualizados = Negocio.objects.filter(empresa_prestadora=de).update(empresa_prestadora=para)
        medicoes_atualizadas = Medicao.objects.filter(empresa=de).update(empresa=para)

    _registrar_log(
        request, 'atualizacao', 'Empresas Prestadoras',
        f'Renomeada "{de}" -> "{para}" ({negocios_atualizados} negócio(s), {medicoes_atualizadas} medição(ões))',
    )
    return Response({'negocios_atualizados': negocios_atualizados, 'medicoes_atualizadas': medicoes_atualizadas})


# Renomeia (razão social) um cliente em cascata. Negócio, Ordem de Serviço, Orçamento
# (Levantamento) e Proposta referenciam o Cliente por chave estrangeira — ao editar o
# cliente direto (PATCH /clientes/<id>/) eles já mostram o nome novo sozinhos, sem
# precisar de nada aqui. Só a Medição guarda o nome do cliente copiado como texto.
@api_view(['POST'])
@permission_classes([permissao_modulo(*COMERCIAL, *FINANCEIRO)])
def renomear_cliente(request):
    de = str(request.data.get('de') or '').strip()
    para = str(request.data.get('para') or '').strip()
    if not de or not para:
        return Response({'error': 'Informe "de" e "para".'}, status=status.HTTP_400_BAD_REQUEST)
    if de == para:
        return Response({'medicoes_atualizadas': 0})

    with transaction.atomic():
        medicoes_atualizadas = Medicao.objects.filter(cliente=de).update(cliente=para)

    _registrar_log(
        request, 'atualizacao', 'Clientes',
        f'Cliente renomeado "{de}" -> "{para}" ({medicoes_atualizadas} medição(ões))',
    )
    return Response({'medicoes_atualizadas': medicoes_atualizadas})


# Renomeia um fornecedor em cascata no Financeiro. Fornecedor não é FK em lugar nenhum: o nome
# é copiado como texto nas solicitações de pagamento, contas a pagar etc. Roda no servidor
# (e não pelo replace-all da tela) porque quem só tem acesso a Compras não enxerga esses
# registros completos — a cascata feita no navegador simplesmente não os alcançava.
@api_view(['POST'])
@permission_classes([permissao_modulo(*COMPRAS_GESTAO, *FINANCEIRO)])
def renomear_fornecedor(request):
    from .models import (
        Banco, SolicitacaoPagamento, ContaPagar, NotaFiscal, ContaReceber,
        EstudoLocacao, ReciboLocacao, FinanceiroExtra,
    )

    de = str(request.data.get('de') or '').strip()
    para = str(request.data.get('para') or '').strip()
    if not de or not para:
        return Response({'error': 'Informe "de" e "para".'}, status=status.HTTP_400_BAD_REQUEST)
    if de == para:
        return Response({'registros_atualizados': 0})

    atualizados = 0
    with transaction.atomic():
        for model in (Banco, SolicitacaoPagamento, ContaPagar, NotaFiscal, ContaReceber,
                      EstudoLocacao, ReciboLocacao, FinanceiroExtra):
            tem_coluna = any(f.name == 'fornecedor' for f in model._meta.concrete_fields)
            for inst in model.objects.select_for_update().only('pk', 'extra'):
                extra = inst.extra if isinstance(inst.extra, dict) else {}
                if extra.get('fornecedor') != de:
                    continue
                campos = {'extra': {**extra, 'fornecedor': para}}
                if tem_coluna:
                    campos['fornecedor'] = para
                model.objects.filter(pk=inst.pk).update(**campos)
                atualizados += 1

    _registrar_log(request, 'atualizacao', 'Fornecedores',
                   f'Fornecedor renomeado "{de}" -> "{para}" ({atualizados} registro(s) do Financeiro)')
    if atualizados:
        dispatch_collection_changed('financeiro')
    return Response({'registros_atualizados': atualizados})


#ORÇAMENTOS
def _campos_do_model(model, item):
    """Filtra `item` para os campos editáveis do model (sem pk nem o FK `orcamento`)."""
    nomes = {
        f.name for f in model._meta.concrete_fields
        if not f.primary_key and f.name != 'orcamento'
    }
    return {k: v for k, v in item.items() if k in nomes}


# --- Funções Customizadas ---
@api_view(['POST'])
@permission_classes([permissao_modulo('orcamentos', 'crm')])
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
        # Id inexistente estourava IntegrityError (FK) no get_or_create abaixo -> 500.
        if not Negocio.objects.filter(pk=negocio_id).exists():
            return Response({'error': 'Negócio não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if cliente_id and not Cliente.objects.filter(pk=cliente_id).exists():
            return Response({'error': 'Cliente não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

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
            'impostos_locacao': resumo_data.get('impostos_locacao', resumo_data.get('impostosLocacao', 0)),
            'qnt': resumo_data.get('qnt', resumo_data.get('quantidadeItensProduzidos', 1)),
            'atividades_macro': resumo_data.get('atividades_macro', resumo_data.get('atividadesMacro', [])) or [],
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

        # Itens: só os campos que existem no model (campo desconhecido no JSON dava TypeError
        # -> 500) e valor inválido (ex.: texto num campo numérico) vira 400, desfazendo a
        # transação inteira em vez de deixar o orçamento pela metade.
        for chave, model in (('mao_de_obra', MDO), ('materiais', Material),
                             ('terceirizados', Servico_terceirizado), ('atividades', Ativ_prevista)):
            for item in request.data.get(chave) or []:
                if not isinstance(item, dict):
                    continue
                if 'duração' in item and 'duracao' not in item:
                    item = {**item, 'duracao': item['duração']}
                dados = _campos_do_model(model, item)
                try:
                    with transaction.atomic():
                        model.objects.create(orcamento=orcamento_instance, **dados)
                except (DjangoValidationError, ValueError, TypeError, DataError, IntegrityError) as exc:
                    transaction.set_rollback(True)
                    detalhe = exc.message_dict if hasattr(exc, 'message_dict') else str(exc)
                    return Response({'error': f'Item inválido em "{chave}".', 'detalhe': detalhe},
                                    status=status.HTTP_400_BAD_REQUEST)

        # Itens de locação: replace-all na fonte (o Negócio), agora com precificação.
        # Só age quando a chave é enviada (orçamento de serviço puro não mexe na alocação).
        itens_alocacao = request.data.get('itens_alocacao', None)
        if itens_alocacao is not None and negocio_id:
            def _num(v):
                try:
                    if v in (None, ''):
                        return 0
                    return float(str(v).replace(',', '.'))
                except (TypeError, ValueError):
                    return 0
            try:
                negocio_aloc = Negocio.objects.get(id=negocio_id)
                negocio_aloc.itens_alocacao.all().delete()
                for item in (itens_alocacao if isinstance(itens_alocacao, list) else []):
                    if not isinstance(item, dict):
                        continue
                    equipamento = str(item.get('equipamento') or '').strip()
                    if not equipamento:
                        continue
                    ItemAlocacao.objects.create(
                        negocio=negocio_aloc,
                        equipamento=equipamento[:200],
                        estoque_ref=str(item.get('estoque_ref') or item.get('estoqueRef') or '')[:120],
                        unidade=str(item.get('unidade') or 'un')[:20],
                        quantidade=_num(item.get('quantidade')),
                        observacao=str(item.get('observacao') or ''),
                        valor_indenizacao=_num(item.get('valor_indenizacao') if item.get('valor_indenizacao') is not None else item.get('valorIndenizacao')),
                        valor_locacao=_num(item.get('valor_locacao') if item.get('valor_locacao') is not None else item.get('valorLocacao')),
                        margem=_num(item.get('margem')),
                        oh=_num(item.get('oh')),
                    )
            except Negocio.DoesNotExist:
                pass

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

class OrdemServicoViewSet(LogMixin, viewsets.ModelViewSet):
    """
    ViewSet para gerenciar Ordens de Servico (OS)
    Operações: CREATE, READ, UPDATE, DELETE
    """
    queryset = OrdemServico.objects.select_related('cliente', 'negocio').all()
    serializer_class = OrdemServicoSerializer
    permission_classes = [permissao_modulo(*COMERCIAL, *PRODUCAO, *FINANCEIRO)]
    LOG_MODULO = 'Ordens de Serviço'
    
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

    # `config` são os dados da empresa (nome, CNPJ, empresas prestadoras) — só admin.
    # `listas` são auxiliares (departamentos, categorias): quem grava é o Financeiro, ao
    # cadastrar um departamento novo (useFin.addDepartamento) — então admin/gerente e equipe
    # financeira. Antes qualquer autenticado podia substituir (e zerar) as listas.
    if 'config' in payload and not eh_admin(request.user):
        return Response(
            {'detail': 'Apenas administradores podem alterar as configurações da empresa.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if 'listas' in payload and not _equipe_financeira(request.user):
        return Response(
            {'detail': 'Apenas administradores, gerentes e a equipe financeira podem alterar as listas auxiliares.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if inst is None:
        inst = ConfiguracaoApp.objects.create()
    if 'config' in payload and isinstance(payload['config'], dict):
        inst.config = payload['config']
    if 'listas' in payload and isinstance(payload['listas'], dict):
        inst.listas = payload['listas']
    inst.save()
    _registrar_log(request, 'atualizacao', 'Configurações', 'Configurações da empresa atualizadas.')

    return Response({'config': inst.config, 'listas': inst.listas}, status=status.HTTP_200_OK)


# Mesma rede de segurança do replace-all do Financeiro (ver comentário acima) — o
# Almoxarifado é o mesmo padrão de objeto agregado único substituído por inteiro a cada
# save, e já sofreu exatamente esse tipo de perda: uma tela que espelha o backend em
# estado local e re-salva sozinha a qualquer mudança pode persistir uma cópia incompleta
# (hidratação que ainda não terminou, aba antiga) e apagar tables/históricos inteiros.
ALMOXARIFADO_QUEDA_PISO_MINIMO = 10
ALMOXARIFADO_QUEDA_FRACAO_MAXIMA = 0.5  # recusa se o total novo for menos da metade do atual


def _almoxarifado_contar_itens(obj):
    """Linhas de todas as tables + entradas de histórico — o que baliza se um payload
    'encolheu drasticamente' em relação ao que já está salvo."""
    if not isinstance(obj, dict):
        return 0
    tabelas = obj.get('tables') if isinstance(obj.get('tables'), list) else []
    total_linhas = sum(len(t.get('rows') or []) for t in tabelas if isinstance(t, dict))
    total_historicos = sum(
        len(obj.get(chave) or []) if isinstance(obj.get(chave), list) else 0
        for chave in ('romaneiosHistorico', 'manutencaoHistorico', 'baixasHistorico', 'alocacoesHistorico')
    )
    return total_linhas + total_historicos


@api_view(['GET', 'POST', 'PUT'])
@permission_classes([permissao_modulo(*SUPRIMENTOS, *COMPRAS_GESTAO)])
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
    if not isinstance(payload, dict):
        payload = {}

    contagem_atual = _almoxarifado_contar_itens(almox_read())
    contagem_nova = _almoxarifado_contar_itens(payload)
    if contagem_atual >= ALMOXARIFADO_QUEDA_PISO_MINIMO and contagem_nova < contagem_atual * ALMOXARIFADO_QUEDA_FRACAO_MAXIMA:
        return Response(
            {
                'error': (
                    f'Operação recusada: o objeto enviado ({contagem_nova} item(ns)/registro(s)) é muito '
                    f'menor que o total atual salvo ({contagem_atual}). Isso indica uma cópia desatualizada '
                    f'do Almoxarifado, que apagaria dados. Recarregue a página e tente novamente.'
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = almox_replace(payload)
    _registrar_log(request, 'atualizacao', 'Almoxarifado', 'Estoque/almoxarifado atualizado.')
    return Response(result, status=status.HTTP_200_OK)


# Rede de segurança do replace-all abaixo: um POST em financeiro/ nunca deve encolher o
# banco de forma drástica. Isso já causou perda real de dados uma vez — uma escrita partiu
# de uma cópia incompleta do estado atual (a busca que deveria trazer tudo falhou e devolveu
# uma lista vazia/parcial), e o replace-all apagou tudo que não estava nela. Com poucos
# registros (ambiente novo/de teste) essa checagem não faz sentido, daí o piso mínimo.
FINANCEIRO_QUEDA_PISO_MINIMO = 20
FINANCEIRO_QUEDA_FRACAO_MAXIMA = 0.5  # recusa se a lista nova tiver menos da metade do total atual


def _financeiro_contagem_atual():
    from .models import (
        Banco, SolicitacaoPagamento, ContaPagar, NotaFiscal, ContaReceber,
        EstudoLocacao, ReciboLocacao, FinanceiroExtra,
    )
    modelos = (Banco, SolicitacaoPagamento, ContaPagar, NotaFiscal, ContaReceber,
               EstudoLocacao, ReciboLocacao, FinanceiroExtra)
    return sum(m.objects.count() for m in modelos)


# Campos de ContaPagar visíveis pra quem não tem nenhuma permissão de Financeiro — só o
# suficiente pra "Itens para Adicionar" (Almoxarifado) saber se o documento de compra já
# foi anexado (contaTemDocumento no frontend usa exatamente esses campos). Fornecedor,
# valor, natureza, observações e comprovantes ficam de fora.
_FINANCEIRO_CAMPOS_CONTAPAGAR_PUBLICOS = {'id', 'tipo', 'status', 'documento', 'anexos'}


# "Equipe financeira": quem tem alguma permissão do Financeiro ALÉM de finSolicitacao. Só
# finSolicitacao é a tela "Solicitação de Pagamento", que qualquer colaborador usa pra pedir
# um pagamento — não faz da pessoa alguém que pode ler/alterar o Financeiro inteiro.
FINANCEIRO_EQUIPE = tuple(chave for chave in FINANCEIRO if chave != 'finSolicitacao')


def _equipe_financeira(user):
    return tem_permissao_modulo(user, FINANCEIRO_EQUIPE)


def _sem_permissao_financeira(user):
    return not _equipe_financeira(user)


class FinanceiroEscritaNegada(Exception):
    """Escrita restrita tentou criar/alterar/apagar algo fora do alcance do usuário."""


def _canon(registro):
    import json
    return json.dumps(registro, sort_keys=True, default=str)


def _financeiro_mesclar_escrita_restrita(payload, user):
    """Replace-all de quem NÃO é equipe financeira (só finSolicitacao e/ou Compras/Gestão).

    Essa pessoa leu uma visão restrita (GET: sem solicitações alheias, contas a pagar só
    com campos públicos) e manda essa visão de volta com a mudança dela. Aqui a lista final
    é montada a partir do BANCO, aplicando só o que ela pode mudar:
      * solicitação PRÓPRIA: criar, editar e excluir (aprovar/reprovar segue barrado adiante).
        O dono é sempre carimbado pelo servidor — nunca dá pra criar/transferir em nome de outro;
      * conta a pagar NOVA, se tiver permissão de Compras/Gestão (Kanban de Compras gera a
        conta ao comprar) — nunca alterar/excluir uma existente;
      * campo `fornecedor`, se tiver a permissão 'fornecedores' (renomear fornecedor em cascata).
    Registro que ela não vê é preservado como está; qualquer outra diferença em relação ao
    que ela recebeu (banco, NFe, conta de outro, solicitação alheia...) -> FinanceiroEscritaNegada.
    """
    from .financeiro_sync import read_all

    completos = {r['id']: r for r in read_all()}
    visao = {r['id']: r for r in _financeiro_restringir_para_leitor_sem_acesso(read_all(), user)}
    pode_criar_conta = tem_permissao_modulo(user, COMPRAS_GESTAO)
    pode_renomear_fornecedor = tem_permissao_modulo(user, ('fornecedores',))

    enviados = {}
    for registro in payload:
        if isinstance(registro, dict) and str(registro.get('id') or '').strip():
            enviados.setdefault(str(registro['id']).strip(), registro)

    resultado = []
    for rid, completo in completos.items():
        if rid not in visao:
            if rid in enviados:
                raise FinanceiroEscritaNegada(rid)
            resultado.append(completo)  # solicitação alheia: invisível e intocável
            continue
        visto, novo = visao[rid], enviados.get(rid)
        if novo is None:
            if completo.get('tipo') == 'solicitacao' and _solicitacao_do_usuario(completo, user):
                continue  # excluiu a própria solicitação
            raise FinanceiroEscritaNegada(rid)
        if _canon(novo) == _canon(visto):
            resultado.append(completo)  # inalterado (contaPagar volta completa, não aparada)
            continue
        if completo.get('tipo') == 'solicitacao' and novo.get('tipo') == 'solicitacao'                 and _solicitacao_do_usuario(completo, user):
            # O dono vem do banco: edita a própria, mas não a transfere pra outra pessoa.
            resultado.append({**novo, 'solicitanteCpf': completo.get('solicitanteCpf', ''),
                              'solicitanteEmail': completo.get('solicitanteEmail', '')})
            continue
        mudados = {k for k in set(visto) | set(novo) if visto.get(k) != novo.get(k)}
        if pode_renomear_fornecedor and mudados == {'fornecedor'}:
            resultado.append({**completo, 'fornecedor': novo.get('fornecedor')})
            continue
        raise FinanceiroEscritaNegada(rid)

    for rid, novo in enviados.items():
        if rid in completos:
            continue
        if novo.get('tipo') == 'solicitacao':
            # Solicitação nova é sempre de quem está enviando.
            resultado.append({**novo, 'solicitanteCpf': str(getattr(user, 'cpf', '') or ''),
                              'solicitanteEmail': str(getattr(user, 'email', '') or '')})
        elif novo.get('tipo') == 'contaPagar' and pode_criar_conta:
            resultado.append(novo)
        else:
            raise FinanceiroEscritaNegada(rid)
    return resultado


def _solicitacao_do_usuario(registro, user):
    """A solicitação de pagamento (dict do FinRecord) foi criada pelo `user`?"""
    cpf_usuario = str(getattr(user, 'cpf', '') or '').strip()
    email_usuario = str(getattr(user, 'email', '') or '').strip().lower()
    if not cpf_usuario and not email_usuario:
        return False
    cpf_registro = str(registro.get('solicitanteCpf') or '').strip()
    email_registro = str(registro.get('solicitanteEmail') or '').strip().lower()
    if cpf_usuario and cpf_registro and cpf_registro == cpf_usuario:
        return True
    if email_usuario and email_registro and email_registro == email_usuario:
        return True
    return False


def _financeiro_restringir_para_leitor_sem_acesso(dados, user=None):
    """Some com `solicitacao` de outras pessoas (nome do solicitante, fornecedor, valor, motivo
    de reprovação) e reduz `contaPagar` aos campos públicos — pra quem lê o Financeiro só por
    causa de outro módulo (Compras, Almoxarifado, Dashboard), sem ter nenhuma permissão de
    Financeiro em si.

    "Solicitação de Pagamento"/"Meus Pagamentos" são abertos a todo usuário autenticado (sem
    exigir nenhuma permissão de Financeiro — não há nem checkbox pra isso em Usuários & Acessos),
    então as próprias solicitações de quem está lendo continuam aqui mesmo sem permissão alguma;
    só as de outras pessoas são removidas. Sem essa exceção, o autor nunca veria o que ele mesmo
    criou em "Meus Pagamentos".
    """
    restantes = [
        r for r in dados
        if r.get('tipo') != 'solicitacao' or _solicitacao_do_usuario(r, user)
    ]
    for r in restantes:
        if r.get('tipo') == 'contaPagar':
            for campo in list(r.keys()):
                if campo not in _FINANCEIRO_CAMPOS_CONTAPAGAR_PUBLICOS:
                    del r[campo]
    return restantes


@api_view(['GET', 'POST', 'PUT'])
@permission_classes([permissao_modulo(*FINANCEIRO, *COMPRAS_GESTAO)])
def financeiro_data(request):
    """Estado financeiro como lista unificada de FinRecord.

    GET  -> retorna todos os registros (Banco, Solicitação, Conta a Pagar, NFe,
            Conta a Receber, Locação) no formato que o frontend (useFin) consome.
    POST/PUT -> recebe a lista completa de FinRecord e substitui todo o estado
            (espelha o comportamento antigo do blob, que reescrevia tudo).
    """
    from .financeiro_sync import read_all, replace_all

    equipe = _equipe_financeira(request.user)

    def _visao():
        dados = read_all()
        return dados if equipe else _financeiro_restringir_para_leitor_sem_acesso(dados, request.user)

    if request.method == 'GET':
        return Response(_visao(), status=status.HTTP_200_OK)

    payload = request.data
    if isinstance(payload, dict):
        payload = payload.get('financeiro', payload.get('data', []))
    if not isinstance(payload, list):
        return Response({'error': 'Esperado um array de registros financeiros.'}, status=status.HTTP_400_BAD_REQUEST)

    # Quem não é equipe financeira só altera o que é dele — ver _financeiro_mesclar_escrita_restrita.
    if not equipe:
        try:
            payload = _financeiro_mesclar_escrita_restrita(payload, request.user)
        except FinanceiroEscritaNegada:
            return Response(
                {'error': 'Você só pode criar, alterar ou excluir as suas próprias solicitações de pagamento.'},
                status=status.HTTP_403_FORBIDDEN,
            )

    contagem_atual = _financeiro_contagem_atual()
    if contagem_atual >= FINANCEIRO_QUEDA_PISO_MINIMO and len(payload) < contagem_atual * FINANCEIRO_QUEDA_FRACAO_MAXIMA:
        return Response(
            {
                'error': (
                    f'Operação recusada: a lista enviada ({len(payload)} registro(s)) é muito menor que '
                    f'o total atual no banco ({contagem_atual} registro(s)). Isso indica uma cópia '
                    f'desatualizada do Financeiro, que apagaria dados. Recarregue a página e tente novamente.'
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Aprovar/reprovar solicitação é ato de gerência — mesmo tendo permissão de
    # escrita no módulo Financeiro (ex.: finSolicitacao, liberado a todo mundo),
    # um usuário comum não pode fazer essa transição de status por aqui.
    if not escreve_em_tudo(request.user):
        from .models import SolicitacaoPagamento
        status_atual = dict(SolicitacaoPagamento.objects.values_list('record_id', 'status'))
        for record in payload:
            if not isinstance(record, dict) or record.get('tipo') != 'solicitacao':
                continue
            novo_status = record.get('status') or 'Aguardando aprovação'
            if novo_status in ('Aprovado', 'Reprovado'):
                rid = str(record.get('id') or '').strip()
                if status_atual.get(rid) != novo_status:
                    return Response(
                        {'error': 'Somente administradores e gerentes podem aprovar ou reprovar solicitações de pagamento.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

    total = replace_all(payload)
    _registrar_log(request, 'atualizacao', 'Financeiro', f'Registros financeiros sincronizados ({total} itens).')
    dispatch_collection_changed('financeiro')
    return Response({'message': 'Financeiro sincronizado.', 'total': total, 'financeiro': _visao()}, status=status.HTTP_200_OK)


@api_view(['POST'])
def financeiro_solicitacao_criar(request):
    """Cria UMA solicitação de pagamento (append-only, sem tocar no resto do estado).

    Aberta a qualquer usuário autenticado DE PROPÓSITO (espelha compras_data): a tela
    "Solicitação de Pagamento" é liberada a TODO colaborador na Sidebar/Home, mas o
    replace-all de financeiro_data continua restrito ao módulo Financeiro. O `tipo`
    é forçado para 'solicitacao', então por aqui não se cria/altera conta, banco,
    NFe etc. — só entra a solicitação, que segue o fluxo normal de aprovação.
    """
    from .financeiro_sync import _build_instance, read_all
    from .models import SolicitacaoPagamento

    record = dict(request.data) if isinstance(request.data, dict) else {}
    record['tipo'] = 'solicitacao'
    rid = str(record.get('id') or '').strip()
    if not rid:
        return Response({'error': 'Campo "id" é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
    if SolicitacaoPagamento.objects.filter(record_id=rid).exists():
        return Response({'error': 'Já existe uma solicitação com este id.'}, status=status.HTTP_409_CONFLICT)
    # Sempre nasce aguardando aprovação (antes era setdefault: dava pra criar já "Aprovado"
    # e pular a gerência) e sempre em nome de quem está logado (não dá pra pedir em nome
    # de outra pessoa nem "adotar" a solicitação de alguém).
    record['status'] = 'Aguardando aprovação'
    for campo in ('aprovadoPor', 'reprovadoPor', 'motivoReprovacao'):
        record.pop(campo, None)
    record['solicitanteCpf'] = str(getattr(request.user, 'cpf', '') or '')
    record['solicitanteEmail'] = str(getattr(request.user, 'email', '') or '')

    instance = _build_instance('solicitacao', record)
    instance.save()
    _registrar_log(request, 'criacao', 'Financeiro', f'Solicitação de pagamento {rid} criada.')
    dispatch_collection_changed('financeiro')
    dados = read_all()
    if _sem_permissao_financeira(request.user):
        dados = _financeiro_restringir_para_leitor_sem_acesso(dados, request.user)
    return Response({'message': 'Solicitação enviada.', 'financeiro': dados}, status=status.HTTP_201_CREATED)


def _gen_fin_id(prefix):
    """Mesmo formato do `genFinId` do frontend (finData.ts): PREFIXO-<timestamp em base36,
    maiúsculo>. Mantém os ids gerados aqui visualmente idênticos aos gerados no cliente."""
    import time
    ms = int(time.time() * 1000)
    digitos = '0123456789abcdefghijklmnopqrstuvwxyz'
    b36 = ''
    n = ms
    while n:
        b36 = digitos[n % 36] + b36
        n //= 36
    return f'{prefix}-{(b36 or "0").upper()}'


@api_view(['POST'])
def financeiro_solicitacao_decidir(request, rid):
    """Aprova ou reprova UMA solicitação de pagamento — update direto no registro (e
    criação da(s) Conta(s) a Pagar correspondente(s), tudo numa transação), em vez do
    replace-all que `financeiro_data` usa para o resto do módulo.

    Por quê: o replace-all é "ler a lista inteira -> montar a lista inteira -> regravar a
    lista inteira". Quando duas aprovações acontecem perto uma da outra (comum com várias
    pessoas de gerência aprovando pagamentos ao mesmo tempo), a segunda gravação pode se
    basear numa cópia que ainda não tinha a mudança da primeira e sobrescrevê-la em
    silêncio — foi isso que causou, em produção, aprovações que ficaram sem o nome de
    quem aprovou (campo `aprovadoPor`) sem nenhum erro aparecer pra ninguém. Esse
    endpoint, por travar (`select_for_update`) e alterar só ESSE registro dentro de uma
    transação, elimina essa corrida pra aprovação/reprovação por completo — outras
    solicitações continuam podendo ser aprovadas em paralelo sem se atrapalharem.

    POST /comercial/financeiro/solicitacao/<rid>/decidir/
    body: {"acao": "aprovar"} ou {"acao": "reprovar", "motivo": "..."}
    """
    from .models import SolicitacaoPagamento, ContaPagar
    from .financeiro_sync import _dec, read_all

    if not escreve_em_tudo(request.user):
        return Response(
            {'error': 'Somente administradores e gerentes podem aprovar ou reprovar solicitações de pagamento.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    acao = request.data.get('acao')
    if acao not in ('aprovar', 'reprovar'):
        return Response({'error': 'Campo "acao" deve ser "aprovar" ou "reprovar".'}, status=status.HTTP_400_BAD_REQUEST)

    nome_usuario = str(getattr(request.user, 'nome', '') or getattr(request.user, 'email', '') or '')

    with transaction.atomic():
        try:
            sol = SolicitacaoPagamento.objects.select_for_update().get(record_id=rid)
        except SolicitacaoPagamento.DoesNotExist:
            return Response({'error': 'Solicitação não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        extra = dict(sol.extra) if isinstance(sol.extra, dict) else {}
        status_atual = extra.get('status') or 'Aguardando aprovação'
        if status_atual in ('Aprovado', 'Reprovado'):
            return Response(
                {'error': f'Esta solicitação já foi {status_atual.lower()}.'},
                status=status.HTTP_409_CONFLICT,
            )

        if acao == 'reprovar':
            motivo = str(request.data.get('motivo') or '')
            extra['status'] = 'Reprovado'
            extra['motivoReprovacao'] = motivo
            extra['reprovadoPor'] = nome_usuario
            sol.status = 'Reprovado'
            sol.extra = extra
            sol.save(update_fields=['status', 'extra', 'updated_at'])
            _registrar_log(request, 'atualizacao', 'Financeiro', f'Solicitação {rid} reprovada por {nome_usuario}.')
            dispatch_collection_changed('financeiro')
            return Response({'message': 'Solicitação reprovada.', 'financeiro': read_all()}, status=status.HTTP_200_OK)

        # acao == 'aprovar' — mesma lógica de useFin.ts:approveSolicitacao, portada pro
        # backend pra rodar dentro da transação travada (ver docstring acima).
        from django.utils import timezone
        agora = timezone.now().isoformat()

        faturado = extra.get('faturado') if isinstance(extra.get('faturado'), dict) else None
        parcelas = faturado.get('parcelas') if faturado and isinstance(faturado.get('parcelas'), list) else None

        if extra.get('forma') == 'Parcelado' and parcelas:
            mae_id = _gen_fin_id('CP')
            total_fatura = sum((_dec(p.get('valor')) for p in parcelas), _dec(0))
            nf_anexo = ((faturado.get('notaFiscal') or {}).get('anexoUrl')) if isinstance(faturado.get('notaFiscal'), dict) else None
            mae_anexos = [nf_anexo] if nf_anexo else []

            mae_extra = {
                'id': mae_id, 'tipo': 'contaPagar', 'origemSolicitacao': rid, 'type': 'parent',
                'parentId': None, 'parcela': 'Mãe', 'totalParcelas': len(parcelas),
                'empresa': extra.get('empresa', ''), 'vinculoTipo': extra.get('vinculoTipo', ''),
                'vinculoValor': extra.get('vinculoValor', ''), 'fornecedor': extra.get('fornecedor', ''),
                'tipoPagamento': extra.get('tipoPagamento', ''), 'natureza': extra.get('natureza', ''),
                'documento': extra.get('documento', ''), 'valor': float(total_fatura),
                'vencimento': (parcelas[0] or {}).get('vencimento', ''), 'banco': '',
                'forma': extra.get('forma', ''), 'status': 'Parcelado', 'anexos': mae_anexos,
                'descricao': extra.get('descricao', ''), 'valorPago': 0, 'jurosPago': 0,
                'comprovantes': [], 'createdAt': agora, 'dataPagamento': '',
                'departamentoPagamento': extra.get('departamentoPagamento', ''),
            }
            ContaPagar(
                record_id=mae_id, extra=mae_extra, type='parent', parent_record_id=None,
                parcela='Mãe', total_parcelas=len(parcelas), empresa=mae_extra['empresa'],
                vinculo_tipo=mae_extra['vinculoTipo'], vinculo_valor=mae_extra['vinculoValor'],
                fornecedor=mae_extra['fornecedor'], tipo=mae_extra['tipoPagamento'],
                natureza=mae_extra['natureza'], documento=mae_extra['documento'],
                valor=total_fatura, vencimento=mae_extra['vencimento'], banco='',
                forma=mae_extra['forma'], status='Parcelado', anexos=mae_anexos,
                comprovantes=[], valor_pago=_dec(0), data_pagamento='', juros_pago=_dec(0),
            ).save()

            nova_lista_parcelas = []
            for i, p in enumerate(parcelas):
                filha_id = f"{mae_id}-{str(i + 1).zfill(2)}"
                valor_parcela = _dec(p.get('valor'))
                anexo_url = p.get('anexoUrl')
                filha_anexos = [anexo_url] if anexo_url else []
                filha_extra = {
                    'id': filha_id, 'tipo': 'contaPagar', 'origemSolicitacao': rid, 'type': 'child',
                    'parentId': mae_id, 'parcela': f'{i + 1}/{len(parcelas)}', 'totalParcelas': len(parcelas),
                    'empresa': extra.get('empresa', ''), 'vinculoTipo': extra.get('vinculoTipo', ''),
                    'vinculoValor': extra.get('vinculoValor', ''), 'fornecedor': extra.get('fornecedor', ''),
                    'tipoPagamento': extra.get('tipoPagamento', ''), 'natureza': extra.get('natureza', ''),
                    'documento': extra.get('documento', ''), 'valor': float(valor_parcela),
                    'vencimento': p.get('vencimento', ''), 'banco': '', 'forma': extra.get('forma', ''),
                    'status': 'Aberto', 'anexos': filha_anexos, 'descricao': extra.get('descricao', ''),
                    'valorPago': 0, 'jurosPago': 0, 'comprovantes': [], 'createdAt': agora, 'dataPagamento': '',
                    'departamentoPagamento': extra.get('departamentoPagamento', ''),
                }
                ContaPagar(
                    record_id=filha_id, extra=filha_extra, type='child', parent_record_id=mae_id,
                    parcela=filha_extra['parcela'], total_parcelas=len(parcelas), empresa=filha_extra['empresa'],
                    vinculo_tipo=filha_extra['vinculoTipo'], vinculo_valor=filha_extra['vinculoValor'],
                    fornecedor=filha_extra['fornecedor'], tipo=filha_extra['tipoPagamento'],
                    natureza=filha_extra['natureza'], documento=filha_extra['documento'],
                    valor=valor_parcela, vencimento=filha_extra['vencimento'], banco='',
                    forma=filha_extra['forma'], status='Aberto', anexos=filha_anexos,
                    comprovantes=[], valor_pago=_dec(0), data_pagamento='', juros_pago=_dec(0),
                ).save()
                nova_lista_parcelas.append({**p, 'contaPagarId': filha_id})

            extra['status'] = 'Aprovado'
            extra['aprovadoPor'] = nome_usuario
            extra['faturado'] = {**faturado, 'maeContaPagarId': mae_id, 'parcelas': nova_lista_parcelas}
        else:
            cp_id = _gen_fin_id('CP')
            cp_anexos = extra.get('anexos') if isinstance(extra.get('anexos'), list) else []
            cp_extra = {
                'id': cp_id, 'tipo': 'contaPagar', 'origemSolicitacao': rid, 'type': 'single',
                'empresa': extra.get('empresa', ''), 'vinculoTipo': extra.get('vinculoTipo', ''),
                'vinculoValor': extra.get('vinculoValor', ''), 'fornecedor': extra.get('fornecedor', ''),
                'tipoPagamento': extra.get('tipoPagamento', ''), 'natureza': extra.get('natureza', ''),
                'documento': extra.get('documento', ''), 'valor': extra.get('valor', 0),
                'vencimento': extra.get('vencimento', ''), 'banco': '', 'forma': extra.get('forma', ''),
                'status': 'Aberto', 'anexos': cp_anexos, 'descricao': extra.get('descricao', ''),
                'valorPago': 0, 'jurosPago': 0, 'comprovantes': [], 'createdAt': agora, 'dataPagamento': '',
                'departamentoPagamento': extra.get('departamentoPagamento', ''),
            }
            ContaPagar(
                record_id=cp_id, extra=cp_extra, type='single', parent_record_id=None,
                parcela='', total_parcelas=1, empresa=cp_extra['empresa'],
                vinculo_tipo=cp_extra['vinculoTipo'], vinculo_valor=cp_extra['vinculoValor'],
                fornecedor=cp_extra['fornecedor'], tipo=cp_extra['tipoPagamento'],
                natureza=cp_extra['natureza'], documento=cp_extra['documento'],
                valor=_dec(cp_extra['valor']), vencimento=cp_extra['vencimento'], banco='',
                forma=cp_extra['forma'], status='Aberto', anexos=cp_anexos,
                comprovantes=[], valor_pago=_dec(0), data_pagamento='', juros_pago=_dec(0),
            ).save()

            extra['status'] = 'Aprovado'
            extra['aprovadoPor'] = nome_usuario

        sol.status = 'Aprovado'
        sol.extra = extra
        sol.save(update_fields=['status', 'extra', 'updated_at'])

    _registrar_log(request, 'atualizacao', 'Financeiro', f'Solicitação {rid} aprovada por {nome_usuario}.')
    dispatch_collection_changed('financeiro')
    return Response({'message': 'Solicitação aprovada.', 'financeiro': read_all()}, status=status.HTTP_200_OK)


# Mesma rede de segurança do Financeiro/Almoxarifado, aplicada ao escopo que o replace-all
# vai substituir (tudo, para quem grava todas; só as compras do próprio usuário, para os demais).
COMPRAS_QUEDA_PISO_MINIMO = 10
COMPRAS_QUEDA_FRACAO_MAXIMA = 0.5

# Quem enxerga/altera TODAS as compras, por coleção, segundo a permissão do painel de
# Usuários & Acessos (admin e gerente sempre). Sem nenhuma delas, a pessoa só lê, grava e
# apaga as PRÓPRIAS compras (é o "Minhas Compras"/abrir requisição, liberado a todos).
COMPRAS_ACESSO = {
    'compras': {  # requisições do kanban
        'ler': ('kanbanCompras', 'aprovarComercial', 'aprovarFinanceiro', 'finCustoOs'),
        'gravar': ('kanbanCompras', 'aprovarComercial', 'aprovarFinanceiro'),
    },
    'comprasHistorico': {
        # Histórico de Compras anexa a NF-e; Itens para Adicionar marca "no estoque";
        # o Kanban é quem move o pedido para o histórico ao finalizar.
        'ler': ('kanbanCompras', 'aprovarComercial', 'aprovarFinanceiro', 'historicoCompras',
                'itensAdicionar', 'finCustoOs'),
        'gravar': ('kanbanCompras', 'historicoCompras', 'itensAdicionar'),
    },
}


@api_view(['GET', 'POST', 'PUT'])
def compras_data(request):
    """Estado de Compras (requisições do kanban + histórico de compras concluídas).

    SEM permissão de módulo na view (fica só no IsAuthenticated padrão): abrir requisição e
    "Minhas Compras" são liberados a TODO usuário. O escopo é decidido por coleção em
    COMPRAS_ACESSO:
      * quem tem permissão de leitura vê todas; os demais só as próprias
        (solicitanteCpf/e-mail/nome — ver compras_sync.pertence_ao_usuario);
      * quem tem permissão de gravação substitui a coleção inteira; os demais só as
        próprias — as de outras pessoas nunca são apagadas, e alterar uma delas é 403
        (reenviá-la inalterada é aceito: quem lê tudo manda a lista inteira de volta).

    GET  -> {'compras': [...requisições...], 'comprasHistorico': [...histórico...]}
    POST/PUT -> recebe {'compras'?: [...], 'comprasHistorico'?: [...]} e substitui
            (replace-all) apenas a(s) coleção(ões) presente(s) no corpo.
    """
    from .compras_sync import (
        ComprasSemPermissao, contar_do_usuario,
        read_requisicoes, read_historico, replace_requisicoes, replace_historico,
        read_requisicoes_do_usuario, read_historico_do_usuario,
        replace_requisicoes_do_usuario, replace_historico_do_usuario,
    )
    from .models import RequisicaoCompra, CompraHistorico

    user = request.user

    def pode(chave, acao):
        return tem_permissao_modulo(user, COMPRAS_ACESSO[chave][acao])

    colecoes = (
        ('compras', RequisicaoCompra, read_requisicoes, read_requisicoes_do_usuario,
         replace_requisicoes, replace_requisicoes_do_usuario),
        ('comprasHistorico', CompraHistorico, read_historico, read_historico_do_usuario,
         replace_historico, replace_historico_do_usuario),
    )

    def _resposta():
        dados = {
            chave: (ler_tudo() if pode(chave, 'ler') else ler_proprias(user))
            for chave, _m, ler_tudo, ler_proprias, *_ in colecoes
        }
        return Response(dados, status=status.HTTP_200_OK)

    if request.method == 'GET':
        return _resposta()

    payload = request.data if isinstance(request.data, dict) else {}
    partes = [chave for chave, *_ in colecoes if chave in payload]

    for chave, model, *_ in colecoes:
        if chave not in payload:
            continue
        if not isinstance(payload.get(chave) or [], list):
            return Response({'error': f'"{chave}" deve ser uma lista.'}, status=status.HTTP_400_BAD_REQUEST)
        contagem_atual = model.objects.count() if pode(chave, 'gravar') else contar_do_usuario(model, user)
        contagem_nova = len(payload.get(chave) or [])
        if contagem_atual >= COMPRAS_QUEDA_PISO_MINIMO and contagem_nova < contagem_atual * COMPRAS_QUEDA_FRACAO_MAXIMA:
            return Response(
                {
                    'error': (
                        f'Operação recusada: a lista enviada ({contagem_nova} registro(s)) é muito menor que '
                        f'o total atual ({contagem_atual}). Isso indica uma cópia desatualizada de Compras, '
                        f'que apagaria dados. Recarregue a página e tente novamente.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    try:
        with transaction.atomic():
            for chave, _m, _lt, _lp, gravar_tudo, gravar_proprias in colecoes:
                if chave not in payload:
                    continue
                if pode(chave, 'gravar'):
                    gravar_tudo(payload.get(chave) or [])
                else:
                    gravar_proprias(payload.get(chave) or [], user)
    except ComprasSemPermissao:
        return Response(
            {'error': 'Você não tem permissão para alterar compras de outras pessoas.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if partes:
        _registrar_log(request, 'atualizacao', 'Compras', f'Compras atualizadas: {", ".join(partes)}.')
        dispatch_collection_changed('compras')
    return _resposta()


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
@permission_classes([permissao_modulo(*COMERCIAL, *PRODUCAO, *FINANCEIRO)])
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

        # Só valores das choices do model — antes qualquer texto era gravado direto.
        for campo, choices in (
            ('status_os', OrdemServico.STATUS_OS_CHOICES),
            ('status_envio', OrdemServico.STATUS_ENVIO_CHOICES),
            ('status_aprovacao', OrdemServico.STATUS_APROVACAO_CHOICES),
        ):
            validos = [valor for valor, _ in choices]
            if campo in request.data and request.data[campo] not in validos:
                return Response(
                    {'error': f'{campo} inválido. Valores aceitos: {", ".join(validos)}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

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
        _registrar_log(request, 'atualizacao', 'Ordens de Serviço', f'Status OS #{pk} atualizado.')

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


class TemplatePropostaViewSet(LogMixin, viewsets.ModelViewSet):
    """CRUD dos templates de texto da Proposta (só texto padrão — sem preço/escopo)."""
    queryset = TemplateProposta.objects.all()
    serializer_class = TemplatePropostaSerializer
    permission_classes = [permissao_modulo('proposta', 'crm', 'orcamentos')]
    LOG_MODULO = 'Templates de Proposta'

    def perform_create(self, serializer):
        # Carimba o autor a partir do usuário autenticado quando o front não mandar.
        u = getattr(self.request, 'user', None)
        autor = getattr(u, 'nome', '') if (u and u.is_authenticated) else ''
        serializer.save(criado_por=serializer.validated_data.get('criado_por') or autor)


class PropostaComercialViewSet(LogMixin, viewsets.ModelViewSet):
    """
    ViewSet para gerenciar Propostas Comerciais
    """
    queryset = PropostaComercial.objects.select_related('cliente', 'negocio').prefetch_related('proposta_escopo').all()
    serializer_class = PropostaComercialSerializer
    permission_classes = [permissao_modulo('proposta', 'crm', 'orcamentos')]
    LOG_MODULO = 'Propostas Comerciais'
    
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
        _registrar_log(request, 'criacao', self.LOG_MODULO, str(proposta))

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

class MedicaoViewSet(LogMixin, viewsets.ModelViewSet):
    """Medições (por OS). Suporta filtros ?ordem_servico= / ?negocio= / ?status=."""
    queryset = Medicao.objects.select_related('negocio', 'ordem_servico').prefetch_related('itens').all()
    serializer_class = MedicaoSerializer
    permission_classes = [permissao_modulo('medicao', 'crm', 'finalizadosComercial', *FINANCEIRO)]
    LOG_MODULO = 'Medições'

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

# vinculo_tipo -> chaves do painel que dão acesso aos documentos daquele módulo
# (as mesmas que liberam escrita no módulo — ver permission_classes de cada ViewSet).
DOCUMENTO_MODULOS = {
    'financeiro': FINANCEIRO,
    'negocio': (*COMERCIAL, *PRODUCAO),
    'os': (*COMERCIAL, *PRODUCAO, *FINANCEIRO),
    'medicao': ('medicao', 'crm', 'finalizadosComercial', *FINANCEIRO),
    'almoxarifado': (*SUPRIMENTOS, *COMPRAS_GESTAO),
    'compras': COMPRAS_GESTAO,
}

def _documento_ids_do_fluxo(user):
    """(vinculo_tipo, ids) dos registros em que o usuário participa como solicitante."""
    from .models import SolicitacaoPagamento, ContaPagar, RequisicaoCompra, CompraHistorico
    from .compras_sync import pertence_ao_usuario

    solicitacoes = {
        s.record_id for s in SolicitacaoPagamento.objects.only('record_id', 'extra')
        if isinstance(s.extra, dict) and _solicitacao_do_usuario(s.extra, user)
    }
    contas = {
        c.record_id for c in ContaPagar.objects.only('record_id', 'extra')
        if isinstance(c.extra, dict) and str(c.extra.get('origemSolicitacao') or '') in solicitacoes
    }
    compras = {
        x.record_id for model in (RequisicaoCompra, CompraHistorico)
        for x in model.objects.only('record_id', 'extra')
        if pertence_ao_usuario(x.extra if isinstance(x.extra, dict) else {}, user)
    }
    return (('financeiro', solicitacoes | contas), ('compras', compras))


def documentos_visiveis(user, para_alterar=False):
    """Documentos que `user` pode ver (ou, com `para_alterar`, excluir/editar) — regra
    descrita no DocumentoViewSet. Usada também pra liberar o download em /media/
    (ver media_auth)."""
    qs = Documento.objects.all()
    if escreve_em_tudo(user):
        return qs
    # vinculo_tipo é texto livre e há variações de caixa ('OS' e 'os').
    acesso = Q(enviado_por=str(getattr(user, 'cpf', '') or ''))
    for tipo, chaves in DOCUMENTO_MODULOS.items():
        if tem_permissao_modulo(user, chaves):
            acesso |= Q(vinculo_tipo__iexact=tipo)
    if not para_alterar:
        for tipo, ids in _documento_ids_do_fluxo(user):
            if ids:
                acesso |= Q(vinculo_tipo__iexact=tipo, vinculo_id__in=ids)
    return qs.filter(acesso)


class DocumentoViewSet(LogMixin, viewsets.ModelViewSet):
    """Upload e recuperação de documentos (genérico, reutilizável).

    - POST  multipart/form-data: campo `arquivo` (binário) + `vinculo_tipo`,
            `vinculo_id`, `categoria`. O binário vai para o disco (MEDIA_ROOT) e a
            linha no banco guarda caminho + metadados.
    - GET   ?vinculo_tipo=&vinculo_id=&categoria= filtra os documentos de um vínculo.
    - DELETE remove o registro (e o arquivo do disco).

    Acesso (mesma lógica do Financeiro/"Meus Pagamentos"): admin e gerente veem tudo.
    Os demais veem só documentos
      * que eles mesmos enviaram (`enviado_por`);
      * de um módulo em que têm permissão no painel (ver DOCUMENTO_MODULOS) — quem trabalha
        no Financeiro vê os anexos do Financeiro, e assim por diante;
      * ligados a um fluxo de que participam: anexos da própria solicitação de pagamento
        (e das contas a pagar geradas a partir dela) e das próprias compras.
    Excluir/editar: só quem enviou, admin/gerente ou quem tem permissão no módulo — participar
    do fluxo dá leitura, não exclusão (o solicitante não apaga o comprovante do Financeiro).
    Documento fora do alcance do usuário responde 404, não 403, para não revelar que existe.
    """
    queryset = Documento.objects.all()
    serializer_class = DocumentoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = documentos_visiveis(
            self.request.user, para_alterar=self.action in ('destroy', 'update', 'partial_update'),
        )
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
        instance = serializer.save(nome_original=nome, tamanho=tamanho, tipo=content_type,
                                   enviado_por=str(getattr(self.request.user, 'cpf', '') or ''))
        _registrar_log(self.request, 'criacao', 'Documentos', str(instance))

    def perform_destroy(self, instance):
        _registrar_log(self.request, 'exclusao', 'Documentos', str(instance))
        # Remove também o binário do disco (sem apagar o registro deixaria órfãos).
        instance.arquivo.delete(save=False)
        instance.delete()


@api_view(['PATCH'])
@permission_classes([permissao_modulo('medicao', 'crm', 'finalizadosComercial', *FINANCEIRO)])
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
    _registrar_log(request, 'atualizacao', 'Medições', f'Status medição #{pk}: {novo_status}.')

    return Response(MedicaoSerializer(medicao).data, status=status.HTTP_200_OK)


# --- Log de atividades (listagem para admin) ---
from .serializers import LogAtividadeSerializer

@api_view(['GET'])
@permission_classes([IsAdmin])
def logs_atividade(request):
    # IsAdmin cobre role='admin' E is_superuser — antes checava só is_superuser,
    # o que barrava um admin criado pelo painel (role=admin, superuser=False).
    qs = LogAtividade.objects.all()
    data_inicio = request.query_params.get('data_inicio')
    data_fim = request.query_params.get('data_fim')
    if data_inicio:
        qs = qs.filter(timestamp__date__gte=data_inicio)
    if data_fim:
        qs = qs.filter(timestamp__date__lte=data_fim)

    serializer = LogAtividadeSerializer(qs[:500], many=True)
    return Response(serializer.data)

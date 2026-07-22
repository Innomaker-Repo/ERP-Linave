"""Autorização por módulo, espelhando o painel "Usuários & Acessos".

Contexto: até aqui as permissões eram só organização de menu — a API respondia
`AllowAny`, então qualquer um (inclusive sem login) lia e gravava tudo, e um
usuário comum conseguia criar uma conta admin para si. Este módulo fecha isso.

Modelo adotado:

* **Sem login → nada.** O padrão do projeto passou a ser `IsAuthenticated`
  (ver settings.REST_FRAMEWORK).
* **Leitura → qualquer usuário autenticado.** De propósito: o ErpContext carrega
  TODAS as coleções no login, e vários módulos leem dados de outros (Compras lê
  Financeiro nas aprovações, Custo por OS lê Almoxarifado, etc.). Bloquear GET por
  módulo deixaria essas telas silenciosamente vazias.
* **Escrita → precisa da permissão do módulo.** É o que impede um usuário com
  acesso só ao Comercial de alterar o Financeiro, o Estoque, etc.
* **Admin e gerente escrevem em tudo.** O painel de permissões só governa o
  role `usuario` — é assim que a Sidebar já se comporta.
* **Usuários e logs → só admin** (com exceção do próprio perfil, ver views).

As chaves abaixo são exatamente os `id`s de PERMISSAO_GRUPOS em
FrontEnd/src/app/components/modules/Usuarios/UsuariosView.tsx. Ao adicionar uma
aba nova ao painel, adicione a chave no grupo correspondente aqui também.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission

# --- Grupos de permissão (mesmos ids do painel do frontend) -----------------
COMERCIAL = ('crm', 'orcamentos', 'proposta', 'fazerOs', 'medicao',
             'finalizadosComercial', 'clientes')
PRODUCAO = ('obras',)
FINANCEIRO = ('finDashboard', 'finSolicitacao', 'finAprovacoes', 'finPagar',
              'finNfe', 'finReceber', 'finPrevisao', 'finBancos', 'finHistorico',
              'finCustoOs', 'finReciboLocacao')
COMPRAS_GESTAO = ('kanbanCompras', 'aprovacoesCompras', 'historicoCompras', 'fornecedores')
SUPRIMENTOS = ('estoquePublico', 'estoque', 'itensAdicionar', 'historicoBaixa',
               'historicoRomaneio', 'alocadosPorOS')


def role_de(user):
    """Role normalizado ('admin' | 'gerente' | 'usuario' | '')."""
    if not user or not user.is_authenticated:
        return ''
    if getattr(user, 'is_superuser', False):
        return 'admin'
    return str(getattr(user, 'role', '') or '').lower()


def eh_admin(user):
    return role_de(user) == 'admin'


def escreve_em_tudo(user):
    """Admin e gerente não passam pelo painel de permissões (igual à Sidebar)."""
    return role_de(user) in ('admin', 'gerente')


class IsAdmin(BasePermission):
    """Recurso exclusivo de administrador (usuários, logs)."""
    message = 'Apenas administradores podem acessar este recurso.'

    def has_permission(self, request, view):
        return eh_admin(request.user)


class PodeEscreverNoModulo(BasePermission):
    """Leitura para qualquer autenticado; escrita só com permissão do módulo.

    Use a fábrica `permissao_modulo(...)` para instanciar com as chaves do módulo.
    """
    CHAVES: tuple = ()
    message = 'Você não tem permissão para alterar dados deste módulo.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        if escreve_em_tudo(user):
            return True
        permissoes = getattr(user, 'permissoes', None)
        if not isinstance(permissoes, dict):
            return False
        return any(permissoes.get(chave) is True for chave in self.CHAVES)


def permissao_modulo(*chaves):
    """Cria uma permission class que libera escrita para as `chaves` informadas.

    Ex.: `permission_classes = [permissao_modulo(*FINANCEIRO, *COMPRAS_GESTAO)]`
    """
    achatadas = tuple(chaves)
    return type('PermissaoModulo', (PodeEscreverNoModulo,), {'CHAVES': achatadas})

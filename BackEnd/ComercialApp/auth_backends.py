"""Bloqueio de login por excesso de senhas erradas — na camada de autenticação do Django.

Fica aqui (e não só no endpoint /token/) porque há DOIS caminhos de login: a API (JWT,
FlexTokenSerializer) e o admin do Django (/jamanta-fiscal/). Os dois passam por
`django.contrib.auth.authenticate()`, então:

* `BloqueioLoginBackend` recusa a conta bloqueada e a origem (IP) bloqueada nos dois;
* `contar_falha_login` (sinal `user_login_failed`, ligado em apps.py) soma a falha e
  bloqueia ao atingir o limite, venha de onde vier.

Dois níveis, para que errar a senha de OUTRA pessoa não tranque o dono fora do sistema:
* LOGIN_MAX_TENTATIVAS (5) senhas erradas da MESMA origem -> só aquela origem fica
  bloqueada para aquela conta (LoginBloqueioIP). O dono, de outro lugar, continua entrando.
* LOGIN_MAX_TOTAL (20) senhas erradas somando TODAS as origens -> a conta inteira é
  bloqueada (User.login_bloqueado) — barra quem tenta de vários IPs.
Nos dois casos só um admin desbloqueia (painel de Usuários, ou
`manage.py desbloquear_usuario <cpf>`). Login certo zera a contagem daquela origem e a total.

O endpoint /token/ só lê as contagens resultantes para montar o aviso ao usuário.
"""
from django.conf import settings
from django.contrib.auth.backends import ModelBackend
from django.db.models import F

LOGIN_MAX_TENTATIVAS = 5
LOGIN_AVISO_A_PARTIR_DE = 3
LOGIN_MAX_TOTAL = 20


def ip_do_cliente(request):
    """IP real de quem fez o pedido — mesma regra do DRF (NUM_PROXIES): atrás do Traefik o
    REMOTE_ADDR é o do proxy e o do cliente é o último do X-Forwarded-For."""
    if request is None:
        return 'desconhecido'
    meta = getattr(request, 'META', {}) or {}
    remoto = meta.get('REMOTE_ADDR') or 'desconhecido'
    num_proxies = (getattr(settings, 'REST_FRAMEWORK', {}) or {}).get('NUM_PROXIES')
    xff = meta.get('HTTP_X_FORWARDED_FOR')
    if num_proxies and xff:
        enderecos = [e.strip() for e in xff.split(',') if e.strip()]
        if enderecos:
            return enderecos[-min(num_proxies, len(enderecos))][:45]
    return remoto[:45]


def origem_bloqueada(user, request):
    from .models import LoginBloqueioIP
    return LoginBloqueioIP.objects.filter(usuario=user, ip=ip_do_cliente(request), bloqueado=True).exists()


def falhas_da_origem(user, request):
    from .models import LoginBloqueioIP
    registro = LoginBloqueioIP.objects.filter(usuario=user, ip=ip_do_cliente(request)).first()
    return (registro.falhas, registro.bloqueado) if registro else (0, False)


def desbloquear(user_qs):
    """Desbloqueio pelo admin: conta e todas as origens."""
    from .models import LoginBloqueioIP
    user_qs.update(login_bloqueado=False, tentativas_login_falhas=0)
    LoginBloqueioIP.objects.filter(usuario__in=user_qs).delete()


class BloqueioLoginBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        from .models import LoginBloqueioIP, User

        login = kwargs.get(User.USERNAME_FIELD) or username
        alvo = User.objects.filter(pk=login).first() if login else None
        if alvo is not None and origem_bloqueada(alvo, request):
            return None  # vira falha (sinal user_login_failed), como senha errada

        user = super().authenticate(request, username=username, password=password, **kwargs)
        if user is not None:
            # Login certo zera a contagem total e a desta origem.
            if user.tentativas_login_falhas:
                User.objects.filter(pk=user.pk).update(tentativas_login_falhas=0)
                user.tentativas_login_falhas = 0
            LoginBloqueioIP.objects.filter(usuario=user, ip=ip_do_cliente(request), bloqueado=False).delete()
        return user

    def user_can_authenticate(self, user):
        return super().user_can_authenticate(user) and not getattr(user, 'login_bloqueado', False)


def _log(usuario, descricao):
    from .models import LogAtividade
    try:
        LogAtividade.objects.create(usuario_cpf=usuario.cpf, usuario_nome=usuario.nome,
                                    acao='atualizacao', modulo='Sistema', descricao=descricao)
    except Exception:
        pass


def contar_falha_login(sender, credentials, request=None, **kwargs):
    from .models import LoginBloqueioIP, User

    # API chama authenticate(cpf=...); o form do admin, authenticate(username=...).
    login = credentials.get('cpf') or credentials.get('username')
    if not login:
        return
    usuarios = User.objects.filter(cpf=login)
    if not usuarios.update(tentativas_login_falhas=F('tentativas_login_falhas') + 1):
        return  # CPF inexistente: nada a contar
    usuario = usuarios.only('cpf', 'nome', 'tentativas_login_falhas', 'login_bloqueado').first()

    ip = ip_do_cliente(request)
    registro, _ = LoginBloqueioIP.objects.get_or_create(usuario=usuario, ip=ip)
    LoginBloqueioIP.objects.filter(pk=registro.pk).update(falhas=F('falhas') + 1)
    registro.refresh_from_db()

    if registro.falhas >= LOGIN_MAX_TENTATIVAS and not registro.bloqueado:
        LoginBloqueioIP.objects.filter(pk=registro.pk).update(bloqueado=True)
        _log(usuario, f'Login bloqueado a partir do IP {ip} após {registro.falhas} tentativas com senha incorreta.')

    if usuario.tentativas_login_falhas >= LOGIN_MAX_TOTAL and not usuario.login_bloqueado:
        usuarios.update(login_bloqueado=True)
        _log(usuario, f'Conta bloqueada após {usuario.tentativas_login_falhas} tentativas de login com '
                      'senha incorreta (somando todas as origens).')

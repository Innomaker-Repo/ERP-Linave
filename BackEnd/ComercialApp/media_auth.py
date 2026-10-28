"""Download autenticado dos anexos (/media/).

Problema: os anexos são abertos por `<a href>`/`<img src>` com a URL gravada nos registros
(contas a pagar, almoxarifado...) — o navegador não manda o `Authorization: Bearer` nesses
casos, então o nginx servia /media/ pra qualquer um que tivesse o link, logado ou não.

Solução, sem mudar nenhuma URL já gravada:
* No login e a cada refresh do JWT, o backend grava o access token num cookie HttpOnly
  (`erp_media`, path /media/) — o navegador passa a mandá-lo sozinho em todo pedido de anexo.
* Produção: o nginx do frontend, antes de servir /media/<arquivo>, faz um `auth_request` pra
  `/comercial/media-auth/` (ver FrontEnd/default.conf). Django valida o cookie e checa se o
  usuário pode ver aquele arquivo (mesma regra do DocumentoViewSet) e responde 204 ou 401/403.
* Dev (DEBUG): o próprio Django serve /media/ pela view `servir_media`, com a mesma checagem.
"""
import os
from urllib.parse import unquote, urlsplit

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

MEDIA_COOKIE = 'erp_media'
MEDIA_COOKIE_PATH = '/media/'


def definir_cookie_media(response, access_token):
    response.set_cookie(
        MEDIA_COOKIE, access_token,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        path=MEDIA_COOKIE_PATH, httponly=True, secure=not settings.DEBUG, samesite='Lax',
    )
    return response


def apagar_cookie_media(response):
    response.delete_cookie(MEDIA_COOKIE, path=MEDIA_COOKIE_PATH, samesite='Lax')
    return response


def usuario_do_cookie(request):
    from .models import User

    token = request.COOKIES.get(MEDIA_COOKIE)
    if not token:
        return None
    try:
        cpf = AccessToken(token)['cpf']
    except (TokenError, KeyError):
        return None
    return User.objects.filter(cpf=cpf, is_active=True).first()


def _caminho_relativo(caminho):
    """'/media/documentos/x/a.pdf?y' -> 'documentos/x/a.pdf' (ou None se sair de /media/)."""
    caminho = unquote(urlsplit(caminho or '').path)
    prefixo = '/' + settings.MEDIA_URL.strip('/') + '/'
    if not caminho.startswith(prefixo):
        return None
    relativo = caminho[len(prefixo):]
    if not relativo or '..' in relativo.split('/'):
        return None
    return relativo


def pode_baixar(user, relativo):
    """Arquivo de um Documento segue a regra de acesso dele; qualquer outro arquivo de mídia
    (anexos antigos de Negócio/OS gravados direto em FileField) exige só estar logado."""
    from .models import Documento
    from .views import documentos_visiveis

    if not Documento.objects.filter(arquivo=relativo).exists():
        return True
    return documentos_visiveis(user).filter(arquivo=relativo).exists()


def _checar(request, caminho):
    """(status, relativo) — 204 libera; 401 sem sessão; 403 sem acesso."""
    relativo = _caminho_relativo(caminho)
    if relativo is None:
        return 403, None
    user = usuario_do_cookie(request)
    if user is None:
        return 401, relativo
    if not pode_baixar(user, relativo):
        return 403, relativo
    return 204, relativo


def media_auth(request):
    """Alvo do `auth_request` do nginx. O caminho pedido vem em X-Original-URI. Só pode
    responder 2xx/401/403 — qualquer outro código o nginx trata como erro 500."""
    status_code, _ = _checar(request, request.headers.get('X-Original-URI', ''))
    return HttpResponse(status=status_code)


def servir_media(request, path):
    """Serve /media/ em desenvolvimento (DEBUG), com a mesma checagem do nginx."""
    status_code, relativo = _checar(request, settings.MEDIA_URL.rstrip('/') + '/' + path)
    if status_code != 204:
        return HttpResponse(status=status_code)
    arquivo = os.path.join(settings.MEDIA_ROOT, *relativo.split('/'))
    if not os.path.isfile(arquivo):
        raise Http404()
    return FileResponse(open(arquivo, 'rb'))

"""Autenticação JWT para WebSocket (Channels).

O `AuthMiddlewareStack` padrão do Channels é baseado em sessão/cookie — este projeto
autentica 100% via JWT Bearer no header (ver `FrontEnd/src/services/api.ts`), e o
navegador não permite header customizado no handshake do WebSocket. Por isso o token
viaja no único header que o navegador deixa definir, o `Sec-WebSocket-Protocol`:
`new WebSocket(url, ['erp-jwt', token])` (ver FrontEnd/src/services/realtime.ts). NÃO na
query string — URL acaba nos logs de acesso do daphne/Traefik, e o token junto.
Validado aqui com o mesmo `SIMPLE_JWT`/`djangorestframework-simplejwt` da API REST.
"""

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _usuario_do_token(token_str):
    from .models import User

    try:
        token = AccessToken(token_str)
        return User.objects.get(cpf=token['cpf'], is_active=True)
    except (TokenError, User.DoesNotExist, KeyError):
        return AnonymousUser()


# Primeiro item do Sec-WebSocket-Protocol; o segundo é o token. O consumer devolve este
# nome no accept() — o navegador derruba a conexão se o servidor não escolher um dos
# subprotocolos que ele ofereceu.
SUBPROTOCOLO_JWT = 'erp-jwt'


def token_do_subprotocolo(scope):
    subprotocolos = list(scope.get('subprotocols') or [])
    if len(subprotocolos) >= 2 and subprotocolos[0] == SUBPROTOCOLO_JWT:
        return subprotocolos[1]
    return None


class JWTAuthMiddleware(BaseMiddleware):
    """Resolve `scope['user']` a partir do token enviado no Sec-WebSocket-Protocol."""

    async def __call__(self, scope, receive, send):
        token = token_do_subprotocolo(scope)
        scope['user'] = await _usuario_do_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)

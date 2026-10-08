"""Autenticação JWT para WebSocket (Channels).

O `AuthMiddlewareStack` padrão do Channels é baseado em sessão/cookie — este projeto
autentica 100% via JWT Bearer no header (ver `FrontEnd/src/services/api.ts`), e o
navegador não permite header customizado no handshake do WebSocket. Por isso o token
viaja na query string (`wss://.../ws/workspace/?token=...`) e é validado aqui, com o
mesmo `SIMPLE_JWT`/`djangorestframework-simplejwt` já usado na API REST.
"""
from urllib.parse import parse_qs

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


class JWTAuthMiddleware(BaseMiddleware):
    """Resolve `scope['user']` a partir do `?token=` da query string do WebSocket."""

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        token = parse_qs(query_string).get('token', [None])[0]
        scope['user'] = await _usuario_do_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)

"""Roteamento ASGI: HTTP continua no Django normal, WebSocket vai pro WorkspaceConsumer.

Autenticação do WebSocket via JWT na query string (ver `ComercialApp.ws_auth`), não o
`AuthMiddlewareStack` padrão do Channels (que é baseado em sessão/cookie — este projeto
não usa isso pra API).
"""
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from django.urls import path

# Precisa ser chamado ANTES de importar qualquer coisa que toque em models/apps
# (consumers.py importa channels.generic.websocket, que não toca no app registry,
# mas ws_auth.py importa ComercialApp.models dentro da função — lazy de propósito).
django_asgi_app = get_asgi_application()

from ComercialApp.consumers import WorkspaceConsumer  # noqa: E402
from ComercialApp.ws_auth import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTAuthMiddleware(
        URLRouter([
            path('ws/workspace/', WorkspaceConsumer.as_asgi()),
        ])
    ),
})

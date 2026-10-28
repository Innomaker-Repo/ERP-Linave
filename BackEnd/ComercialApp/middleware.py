"""Middleware utilities for ComercialApp."""
import logging

from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class APILoggingMiddleware(MiddlewareMixin):
    """Registra método + caminho de cada requisição em nível DEBUG.

    Só `request.path`, nunca a query string: ela pode carregar dado sensível (antes o
    token do WebSocket ia em `?token=`) e ia parar no stdout do container via print().
    """

    def process_request(self, request):
        logger.debug('%s %s', request.method, request.path)

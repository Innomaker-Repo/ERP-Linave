"""Disparo do aviso "a coleção X mudou" pro grupo de WebSocket.

Chamado DIRETO de dentro das views que escrevem dado (não via sinal `post_save`/
`post_delete` do Django) porque `financeiro_sync.replace_all` e `compras_sync.replace_*`
usam `bulk_create`, que por design do Django NÃO dispara `post_save` — um sinal nunca
veria essas escritas. Chamar explícito daqui, logo após a escrita ter sido confirmada,
evita essa lacuna sem precisar reescrever o replace-all para salvar registro a registro
(reescrita que mexeria em lógica sensível já blindada — guard-rail contra perda de
dado, trava de aprovação só pra admin/gerente — só para viabilizar um sinal).

Nunca deixa uma falha de notificação (Redis fora do ar, channel layer não configurado)
quebrar a escrita em si — a função sempre falha em silêncio, só loga.
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def dispatch_collection_changed(collection: str) -> None:
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            'workspace',
            {'type': 'workspace.notify', 'collection': collection},
        )
    except Exception:
        logger.exception('Falha ao notificar mudança em tempo real da coleção "%s".', collection)

"""Consumer único de tempo real do ERP.

Um grupo só (`"workspace"`) para todo o sistema — dado o tamanho (ERP interno, não
multi-tenant), não compensa segmentar por empresa/departamento nesta primeira versão.
O consumer não serializa nem filtra dado nenhum: só repassa "a coleção X mudou", e o
frontend reaproveita a mesma função de fetch REST que já usa hoje (que já aplica os
filtros de permissão corretos) — ver `dispatch_collection_changed` em `ws_notify.py`.
"""
import json

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .ws_auth import SUBPROTOCOLO_JWT

GRUPO_WORKSPACE = 'workspace'


class WorkspaceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            # Aceita e fecha na hora com 4401, em vez de recusar o handshake: recusado, o
            # navegador só enxerga um 1006 genérico e não sabe que o motivo é o token
            # vencido (realtime.ts usa o 4401 para renovar o token antes de tentar de
            # novo). Nada é enviado nem entra no grupo antes do fechamento.
            oferecidos = self.scope.get('subprotocols') or []
            await self.accept(subprotocol=SUBPROTOCOLO_JWT if SUBPROTOCOLO_JWT in oferecidos else None)
            await self.close(code=4401)
            return
        await self.channel_layer.group_add(GRUPO_WORKSPACE, self.channel_name)
        await self.accept(subprotocol=SUBPROTOCOLO_JWT)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(GRUPO_WORKSPACE, self.channel_name)

    # Mensagens vindas do grupo (via group_send com type="workspace.notify") caem aqui —
    # Channels troca "." por "_" para achar o método handler.
    async def workspace_notify(self, event):
        await self.send_json({'collection': event['collection']})

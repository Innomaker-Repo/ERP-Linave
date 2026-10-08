"""Consumer único de tempo real do ERP.

Um grupo só (`"workspace"`) para todo o sistema — dado o tamanho (ERP interno, não
multi-tenant), não compensa segmentar por empresa/departamento nesta primeira versão.
O consumer não serializa nem filtra dado nenhum: só repassa "a coleção X mudou", e o
frontend reaproveita a mesma função de fetch REST que já usa hoje (que já aplica os
filtros de permissão corretos) — ver `dispatch_collection_changed` em `ws_notify.py`.
"""
import json

from channels.generic.websocket import AsyncJsonWebsocketConsumer

GRUPO_WORKSPACE = 'workspace'


class WorkspaceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return
        await self.channel_layer.group_add(GRUPO_WORKSPACE, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(GRUPO_WORKSPACE, self.channel_name)

    # Mensagens vindas do grupo (via group_send com type="workspace.notify") caem aqui —
    # Channels troca "." por "_" para achar o método handler.
    async def workspace_notify(self, event):
        await self.send_json({'collection': event['collection']})

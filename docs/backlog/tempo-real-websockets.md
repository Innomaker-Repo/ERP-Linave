# Backlog: Sincronização em tempo real (WebSockets / Django Channels)

**Status:** proposto, não iniciado. Aberto em 2026-09-07, a pedido do Andre, para revisão em ~2026-09-14.

## Contexto

Hoje (após a melhoria de 2026-09-07) o `ErpContext` do frontend recarrega todas as
coleções vindas do SQL automaticamente ao voltar o foco na aba e a cada 45s enquanto
ela está visível (`FrontEnd/src/app/context/ErpContext.tsx`, efeito de
`hydrateWorkspace`/`refetchSeVisivel`). Isso resolveu a maior parte do "só atualiza com
F5", mas ainda não é tempo real: no pior caso (usuário com a aba aberta e em foco o
tempo todo) uma alteração feita por outro usuário pode levar até 45s pra aparecer.

Este documento é o plano para a solução definitiva: o backend avisa o frontend na hora
que um dado relevante muda, via WebSocket (Django Channels), em vez de o frontend ficar
perguntando em intervalos.

## Estado atual do projeto (levantado em 2026-09-07 — confirmar antes de implementar, pode ter mudado)

- Django 6.0.3, DRF + `djangorestframework-simplejwt` (`BackEnd/ERP_Linave_BackEnd/settings.py`).
  Usuário customizado `ComercialApp.User`, chave primária `cpf` (não `id`).
- Autenticação 100% via JWT Bearer no header, token guardado em `localStorage` no
  frontend (`FrontEnd/src/services/api.ts`) — **não** usa cookie de sessão pras chamadas
  de API. Isso importa porque o `AuthMiddlewareStack` padrão do Channels espera sessão/
  cookie, não Bearer token; vai precisar de um middleware de auth próprio pro WebSocket.
- `BackEnd/ERP_Linave_BackEnd/asgi.py` existe mas é o arquivo padrão do Django (só
  `get_asgi_application()`), sem `ProtocolTypeRouter` nem nada de Channels.
- Nenhuma dependência de Channels/ASGI real instalada (`channels`, `channels-redis`,
  `daphne`, `uvicorn` — nenhum está em `BackEnd/requirements.txt`, que hoje tem
  `gunicorn==26.0.0` rodando `wsgi.py`).
- Produção roda via Docker Compose + Traefik num servidor próprio (não é Railway/Render/
  Heroku) — `docker-compose.yml` na raiz do repo, comando real de produção é
  `gunicorn ERP_Linave_BackEnd.wsgi:application --workers 3 --threads 2`
  (`docker-compose.yml`). O bloco do Traefik está **comentado** hoje (só ativo pra
  deploy remoto) — ao reativar vai precisar reintroduzir as regras de roteamento,
  incluindo a nova rota de WebSocket.
- Modelos relevantes (todos em `BackEnd/ComercialApp/models.py`, é o único app
  instalado de verdade — `ComprasApp`/`AlmoxarifadoApp` existem como pastas vazias e
  não estão em `INSTALLED_APPS`): `Negocio`, `OrdemServico`, `Medicao`/`MedicaoItem`,
  a família de Financeiro (`SolicitacaoPagamento`, `ContaPagar`, `NotaFiscal`,
  `ContaReceber`, `EstudoLocacao`, `ReciboLocacao`, `FinanceiroExtra` — sem uma tabela
  única "FinRecord", isso é só o conceito do frontend), `RequisicaoCompra`,
  `CompraHistorico`, `EstoqueAlmoxarifado` (linha única com blob JSON), `Cliente`,
  `Fornecedor`, `ConfiguracaoApp`.
- Frontend não tem nenhum cliente WebSocket hoje — só o polling descrito acima.

## Abordagem recomendada

**Notificar, não empurrar dados.** O servidor avisa "a coleção X mudou", o frontend
reaproveita a mesma função de fetch REST que já usa hoje pra buscar só aquela coleção.
Evita duplicar serialização/permissões no consumer do WebSocket e evita o risco de
mandar dado sem o filtro de permissão correto pra quem não devia ver.

1. **Backend — Channels rodando só o WebSocket, HTTP continua no gunicorn/WSGI como
   está.** Não trocar a stack HTTP inteira de uma vez (risco desnecessário). Adicionar
   um segundo processo/serviço no `docker-compose.yml` rodando `daphne` só pra servir
   `/ws/`, atrás do Traefik (quando reativado) roteando por path prefix. O gunicorn/WSGI
   atual continua intocado servindo o resto da API.
   - `pip install channels channels-redis daphne`, adicionar `channels` ao
     `INSTALLED_APPS`, criar `BackEnd/ERP_Linave_BackEnd/routing.py` com
     `ProtocolTypeRouter` + `URLRouter` apontando pra um único consumer.
   - Adicionar Redis ao `docker-compose.yml` (serviço leve, já tem um bloco comentado
     de exemplo pro MySQL que dá pra usar de referência) — necessário porque o
     `channel_layer` em memória não funciona entre processos/workers diferentes, e o
     gunicorn já roda 3 workers.
2. **Um consumer só, um grupo só** (`WorkspaceConsumer`, grupo `"workspace"`) — dado o
   tamanho do sistema (ERP interno, não multi-tenant por enquanto), não vale a pena
   segmentar por empresa/departamento nesta primeira versão. Ao conectar, o consumer
   entra no grupo; ao receber uma mensagem do grupo, repassa pro cliente
   `{"collection": "financeiro"}` (ou `"obras"`, `"os"`, `"compras"`, etc.).
3. **Autenticação do WebSocket via JWT na query string** (`wss://.../ws/?token=...`),
   com um middleware customizado (não o `AuthMiddlewareStack` padrão, que é baseado em
   sessão) que valida o token com o mesmo `SIMPLE_JWT`/`djangorestframework-simplejwt`
   já usado na API — o navegador não permite header customizado no handshake do
   WebSocket, por isso query string (ou subprotocolo) é o caminho de sempre pra isso.
4. **Disparo do lado do backend via `post_save`/`post_delete`** nos modelos listados
   acima (`BackEnd/ComercialApp/signals.py`, novo arquivo) — cada handler resolve pra
   qual "coleção" do frontend aquele modelo pertence e chama
   `async_to_sync(channel_layer.group_send)(...)`. Import do `asgiref.sync.async_to_sync`
   necessário porque signal roda em contexto síncrono do ORM.
5. **Frontend — novo `src/services/realtime.ts`**: abre o WebSocket com o access token
   atual (mesmo de `localStorage` que o `api.ts` já usa), escuta mensagens
   `{collection}` e chama a função de fetch daquela coleção específica (reaproveitando
   as mesmas funções já usadas em `hydrateWorkspace`, mas uma de cada vez em vez do
   `Promise.all` de tudo — já é uma melhoria sobre o polling atual, que sempre busca
   tudo). Reconecta com backoff se cair, e reabre a conexão quando o access token for
   renovado (o token da conexão fica preso ao momento do connect).
   - **Não remover o polling de 45s/foco** — vira um fallback de segurança pra quando o
     socket cair e ainda não reconectou. Assim a pior situação continua sendo "até 45s
     de atraso", nunca "trava pra sempre" se o WebSocket falhar.
6. **Traefik**: ao reativar o bloco comentado do `docker-compose.yml`/`traefik/`, incluir
   a regra de roteamento pra `/ws` apontando pro serviço do daphne, preservando os
   headers de upgrade — Traefik lida com isso nativamente, mas como o bloco está
   desligado há um tempo, testar o roteamento completo (HTTP + WS) antes de ir pra
   produção.

## Riscos / pontos de atenção

- **Autenticação JWT em WebSocket é a parte menos "de manual"** deste plano — é a maior
  fonte de risco de bug de segurança (token vazando em log de acesso do Traefik/nginx
  por ir na query string, por exemplo). Vale considerar mandar o token na primeira
  mensagem após conectar em vez de na URL, se log de query string for uma preocupação
  aqui.
- Precisa de Redis rodando em produção só pra isso — mais uma peça de infra pra
  monitorar/manter no ar (ainda que leve).
- `ComprasApp`/`AlmoxarifadoApp` são pastas vazias, não apps de verdade — os modelos de
  compras/estoque vivem em `ComercialApp` mesmo; não criar signals em apps que não
  existem de fato.
- Efeito colateral bom: como o disparo por coleção fica granular (signal por modelo),
  dá pra fazer o frontend parar de buscar TUDO a cada refresh e passar a buscar só o
  que mudou — reduz carga tanto do polling residual quanto do reload completo que
  existe hoje.

## Estimativa de esforço

Médio-alto: mexe em infra (Redis, novo processo ASGI, Traefik), em autenticação
(middleware novo, ponto sensível), e em um novo cliente no frontend com reconexão. Não
é um "adicionar uma dependência e pronto" — é um projeto de alguns dias, não horas.

## Próximo passo quando for retomado

Confirmar que o levantamento acima ainda bate com o estado do repo (esse documento foi
escrito em 2026-09-07 — se muita coisa mudou no backend desde então, re-levantar antes
de seguir o plano ao pé da letra), decidir o formato de auth do WebSocket (query string
vs. primeira mensagem) e então implementar backend → frontend → infra, nessa ordem.

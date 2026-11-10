# Backlog: Sincronização em tempo real (WebSockets / Django Channels)

**Status:** IMPLEMENTADO em 2026-10-08 (Financeiro + Compras) e testado ao vivo de ponta
a ponta no navegador (escrita via API → tela já aberta atualiza sozinha, sem reload).
`docker-compose.yml`/Traefik também já preparados para produção — não verificados com
`docker-compose up` de verdade nesta máquina (sem Docker instalado aqui); conferir no
servidor de deploy antes de considerar 100% fechado. Detalhes no final deste documento,
seção "Execução real (2026-10-08)".

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

## Execução real (2026-10-08)

Implementado com UM desvio importante em relação ao passo 4 do plano original acima
("Disparo via `post_save`/`post_delete`"): **não usa sinais do Django**. Ao investigar,
`financeiro_sync.replace_all` e `compras_sync.replace_requisicoes/replace_historico`
usam `model.objects.all().delete()` + `model.objects.bulk_create(...)` — e `bulk_create`
é documentado pelo próprio Django como NÃO disparando `post_save`. Um sinal nunca veria
essas escritas. Reescrever o replace-all pra salvar registro a registro só pra viabilizar
o sinal mexeria em lógica sensível já blindada (guard-rail contra perda de dado em
`financeiro_data`/`compras_data`, trava de aprovação só pra admin/gerente) — risco
desnecessário. Em vez disso, o aviso é disparado MANUALMENTE de dentro das views, logo
após a escrita ter sido confirmada (`ComercialApp/ws_notify.py:dispatch_collection_changed`).

Confirmado por varredura completa do repo: só `compras_sync.py` e `financeiro_sync.py`
usam `bulk_create`/`bulk_update` em todo o backend — nenhum outro módulo (Clientes,
Fornecedores, Negócios, OS, Medições, Configurações, Almoxarifado) precisa desse mesmo
tratamento; todos usam `ModelViewSet` do DRF ou `.save()`/`.create()` direto, que já
disparam sinal nativo do Django normalmente (se um dia quiserem tempo real, dá pra usar
sinal de verdade neles, sem o desvio acima).

**Arquivos novos/alterados:**
- `BackEnd/requirements.txt` — `channels`, `channels-redis`, `daphne`.
- `BackEnd/ERP_Linave_BackEnd/settings.py` — `channels` em `INSTALLED_APPS`,
  `ASGI_APPLICATION`, `CHANNEL_LAYERS` (Redis via `REDIS_URL`; cai pra
  `InMemoryChannelLayer` se a env var não existir — só serve pra um processo só, não
  funciona em dev local com `runserver` + `daphne` como dois processos separados, ver
  "Pendências" abaixo).
- `BackEnd/ERP_Linave_BackEnd/routing.py` (novo) — `ProtocolTypeRouter`, HTTP continua
  no Django normal, `/ws/workspace/` vai pro `WorkspaceConsumer`.
- `BackEnd/ERP_Linave_BackEnd/asgi.py` — importa de `routing.py` em vez de expor só
  `get_asgi_application()` puro.
- `BackEnd/ComercialApp/ws_auth.py` (novo) — autentica o WebSocket pelo JWT na query
  string (`?token=...`), mesmo `SIMPLE_JWT` da API REST.
- `BackEnd/ComercialApp/consumers.py` (novo) — `WorkspaceConsumer`, grupo único
  `"workspace"`.
- `BackEnd/ComercialApp/ws_notify.py` (novo) — `dispatch_collection_changed(nome)`,
  chamado manualmente pelas views (ver desvio acima). Nunca deixa uma falha de
  notificação (Redis fora do ar) quebrar a escrita em si — só loga.
- `BackEnd/ComercialApp/views.py` — `dispatch_collection_changed('financeiro')` em
  `financeiro_data` (replace-all) e `financeiro_solicitacao_criar` (criação avulsa);
  `dispatch_collection_changed('compras')` em `compras_data` (replace-all).
- `FrontEnd/src/services/realtime.ts` (novo) — `connectRealtime(onCollectionChanged)`,
  reconecta com backoff exponencial (1s → 30s), relê o token a cada tentativa (cobre
  renovação de token entre quedas).
- `FrontEnd/src/services/network.ts` — `getRealtimeWsUrl(token)`.
- `FrontEnd/src/app/context/ErpContext.tsx` — novo `useEffect` plugando
  `connectRealtime`; ao receber `{collection: 'financeiro'|'compras'}`, rechama só
  `getFinanceiro()`/`getCompras()` (reaproveita as mesmas funções do
  `hydrateWorkspace`) em vez de tudo. Polling de 45s/foco MANTIDO como rede de
  segurança, como o plano original já previa.
- `FrontEnd/vite.config.ts` — proxy `/ws` → `http://localhost:8001` com `ws: true`
  (dev local; replica o que o Traefik faz em produção por path prefix).
- `docker-compose.yml` — serviço `redis` (`redis:7-alpine`, rede interna, sem porta
  exposta); serviço `ws` (mesma imagem do `backend`, comando
  `daphne -p 8001 ERP_Linave_BackEnd.asgi:application`, roteado pelo Traefik por
  `PathPrefix('/ws')`); `REDIS_URL=redis://redis:6379/0` adicionado também ao `backend`
  (os 3 workers do gunicorn publicam no mesmo Redis que o `ws` consome).

**Verificação feita:**
1. `npx tsc --noEmit` (frontend) e `python manage.py check` (backend) limpos.
2. WebSocket real (Node, depois Playwright/navegador real) conectando com JWT válido,
   recebendo `{"collection": "financeiro"}` e `{"collection": "compras"}` logo após uma
   escrita de verdade.
3. **Teste decisivo**: tela "Aprovações" aberta como gerente; uma solicitação nova
   criada via API simulando "outro usuário"; a tela atualizou sozinha, SEM reload nem
   navegação, mostrando a nova solicitação — provando que o pipeline completo
   (backend → Redis/processo → WebSocket → frontend → re-render) funciona.
4. `docker-compose.yml` validado só sintaticamente (YAML parseável, `services:` com as
   chaves esperadas) — **não** rodado com `docker-compose up` de verdade, porque esta
   máquina de desenvolvimento não tem Docker instalado.

**Pendências / pontos de atenção pra quem retomar:**
- **Redis local não foi instalado** (tentativa via `winget install Memurai.MemuraiDeveloper`
  falhou duas vezes com erro de permissão do instalador — `SFXCA: Failed to create temp
  directory. Error code 5` — provavelmente antivírus/política do Windows bloqueando a
  extração temporária que o MSI faz; não é um erro do nosso lado). Sem Redis local, os
  dois processos (`manage.py runserver` pra HTTP + `daphne` pra WS) não compartilham o
  channel layer entre si — tempo real só foi testado localmente concentrando HTTP e WS
  no MESMO processo daphne (prova a lógica, mas não é o setup real de dois processos).
  Em produção isso não é problema: o Redis do `docker-compose.yml` resolve.
- **Channels 4.x não faz mais o `manage.py runserver` virar servidor ASGI/WebSocket
  sozinho** (comportamento que existia no Channels 2.x foi removido). Em dev local
  `/ws` precisa do `daphne` rodando como processo separado (`python -m daphne -p 8001
  ERP_Linave_BackEnd.asgi:application`), com o proxy do Vite (`/ws` → porta 8001)
  cobrindo o roteamento — já configurado em `vite.config.ts`.
- `docker-compose.yml`/Traefik não foram exercitados com Docker de verdade — confirmar
  no servidor de deploy que o serviço `ws` sobe, que o Traefik roteia `/ws` pra ele
  (prioridade de regra: `PathPrefix('/ws')` é mais específico que o `Host()` sozinho do
  `frontend`, deve vencer sem precisar de `priority` explícito — mas vale testar) e que
  o `redis` healthcheck passa antes de `backend`/`ws` tentarem conectar.
- Só Financeiro e Compras disparam o aviso por enquanto. Qualquer outro módulo que
  precisar de tempo real no futuro: se usar `ModelViewSet`/`.save()` direto (todos os
  outros hoje usam), pode usar sinal de verdade do Django (`post_save`/`post_delete`,
  chamando `dispatch_collection_changed` de dentro do handler) em vez do padrão manual
  usado aqui — mais simples de manter quando o sinal funciona de verdade.

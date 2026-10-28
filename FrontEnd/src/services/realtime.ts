/* =========================================================================================
 * Tempo real (WebSocket) — "a coleção X mudou", nada além disso.
 *
 * O backend não manda o dado em si (ver ComercialApp/ws_notify.py): só avisa qual
 * coleção mudou, e aqui quem decide o que fazer é o chamador (ErpContext reaproveita a
 * mesma função de fetch REST que já usa no polling de 45s/foco — ver docs/backlog/
 * tempo-real-websockets.md). Isso evita duplicar serialização/filtro de permissão aqui.
 *
 * Não substitui o polling, é um complemento: se o socket cair e não reconectar a tempo,
 * o polling de 45s/foco continua sendo a rede de segurança.
 * =======================================================================================*/
import { AUTH_ACCESS_KEY, refreshAccessToken } from './authService';
import { getRealtimeWsUrl, realtimeWsProtocols } from './network';

const BACKOFF_INICIAL_MS = 1000;
const BACKOFF_MAXIMO_MS = 30000;

// Fechamento pelo backend por login ausente/vencido (ComercialApp/consumers.py).
const CODIGO_SEM_LOGIN = 4401;

export function connectRealtime(onCollectionChanged: (collection: string) => void): () => void {
  let socket: WebSocket | null = null;
  let reconectarTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let backoffAtualMs = BACKOFF_INICIAL_MS;
  let desconectadoPeloChamador = false;
  // Já renovou o token desde a última conexão aceita? Se o backend recusar de novo logo
  // depois de uma renovação (usuário desativado, p. ex.), para de insistir em vez de
  // entrar em loop renovando.
  let jaRenovouToken = false;

  // Token vencido: uma aba parada em segundo plano não faz chamada REST, então o
  // interceptor do api.ts nunca renova o token por ela — sem isto o socket tentaria com
  // o mesmo token vencido a cada 30s, para sempre (os WSREJECT do log de 23/10).
  const renovarTokenEReconectar = async () => {
    if (jaRenovouToken) {
      console.warn('[tempo real] sessão recusada mesmo após renovar o token — reconexão suspensa.');
      return;
    }
    jaRenovouToken = true;
    const novoToken = await refreshAccessToken();
    if (desconectadoPeloChamador) return;
    if (!novoToken) {
      // Refresh também venceu: a próxima chamada REST leva ao login. Um novo login
      // recria esta conexão (ErpContext depende de userSession).
      console.warn('[tempo real] não foi possível renovar a sessão — reconexão suspensa.');
      return;
    }
    backoffAtualMs = BACKOFF_INICIAL_MS;
    conectar();
  };

  const agendarReconexao = () => {
    if (desconectadoPeloChamador) return;
    reconectarTimeoutId = setTimeout(() => {
      backoffAtualMs = Math.min(backoffAtualMs * 2, BACKOFF_MAXIMO_MS);
      conectar();
    }, backoffAtualMs);
  };

  const conectar = () => {
    if (desconectadoPeloChamador) return;

    // Lê o token na hora de cada tentativa (não só na primeira) — se ele tiver sido
    // renovado (refresh) entre uma queda e a reconexão, usa o novo.
    const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_ACCESS_KEY) : null;
    if (!token) {
      // Sem sessão: não adianta tentar conectar agora — espera o próximo ciclo de
      // backoff e reavalia (cobre o caso de a aba abrir antes do login terminar).
      agendarReconexao();
      return;
    }

    try {
      socket = new WebSocket(getRealtimeWsUrl(), realtimeWsProtocols(token));
    } catch {
      agendarReconexao();
      return;
    }

    socket.onopen = () => {
      backoffAtualMs = BACKOFF_INICIAL_MS;
    };

    socket.onmessage = (event) => {
      try {
        const dados = JSON.parse(event.data);
        if (dados && typeof dados.collection === 'string') {
          onCollectionChanged(dados.collection);
        }
      } catch {
        // Mensagem não reconhecida — ignora, não quebra a conexão por isso.
      }
    };

    socket.onclose = (event) => {
      socket = null;
      // Registro de diagnóstico (F12 > Console): em 23/10 as conexões caíam a cada ~24s.
      // 1006 = cortada sem aviso (rede, proxy, antivírus); 1000/1001 = fechada por alguém
      // de propósito; 4401 = sem login válido.
      console.info(`[tempo real] conexão fechada — código ${event.code}${event.reason ? ` (${event.reason})` : ''}`);
      if (event.code === CODIGO_SEM_LOGIN) {
        void renovarTokenEReconectar();
        return;
      }
      jaRenovouToken = false;
      agendarReconexao();
    };

    // onerror é sempre seguido de onclose (fechamento da conexão) — a reconexão já
    // fica a cargo do onclose, não precisa agendar duas vezes.
    socket.onerror = () => {};
  };

  conectar();

  return () => {
    desconectadoPeloChamador = true;
    if (reconectarTimeoutId) clearTimeout(reconectarTimeoutId);
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
  };
}

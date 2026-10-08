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
import { AUTH_ACCESS_KEY } from './authService';
import { getRealtimeWsUrl } from './network';

const BACKOFF_INICIAL_MS = 1000;
const BACKOFF_MAXIMO_MS = 30000;

export function connectRealtime(onCollectionChanged: (collection: string) => void): () => void {
  let socket: WebSocket | null = null;
  let reconectarTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let backoffAtualMs = BACKOFF_INICIAL_MS;
  let desconectadoPeloChamador = false;

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
      socket = new WebSocket(getRealtimeWsUrl(token));
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

    socket.onclose = () => {
      socket = null;
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

export function getCurrentProtocol(): string {
  if (typeof window !== 'undefined' && window.location?.protocol) {
    return window.location.protocol;
  }

  return 'http:';
}

export function getCurrentHost(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  return '127.0.0.1';
}

export function getServiceUrl(port: number, path = ''): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getCurrentProtocol()}//${getCurrentHost()}:${port}${normalizedPath}`;
}

export function getBackendBaseUrl(): string {
  // Ruta relativa (mismo origen): en dev el proxy de Vite la redirige a
  // Django (localhost:8000); a través de ngrok funciona con un solo túnel
  // sin CORS; en build de producción Django sirve el frontend y la API.
  return `/comercial/`;
}

export function getBackendUrl(path = ''): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${getBackendBaseUrl()}${normalizedPath}`;
}

// Mesma origem relativa que getBackendBaseUrl() (dev: proxy do Vite; produção: Traefik
// roteando por path) — só troca o protocolo HTTP(S) por WS(S).
export function getRealtimeWsUrl(token: string): string {
  const wsProtocol = getCurrentProtocol() === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' && window.location?.host
    ? window.location.host
    : `${getCurrentHost()}:5173`;
  return `${wsProtocol}//${host}/ws/workspace/?token=${encodeURIComponent(token)}`;
}
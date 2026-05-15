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
  return `${getCurrentProtocol()}//${getCurrentHost()}:8000/comercial/`;
}

export function getBackendUrl(path = ''): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${getBackendBaseUrl()}${normalizedPath}`;
}
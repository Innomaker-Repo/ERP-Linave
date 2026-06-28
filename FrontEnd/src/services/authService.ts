import axios from 'axios';

// Chaves que não correspondem ao padrão /workspace|linave|comercial|crm|erp/i
// e por isso não são apagadas por clearLegacyCommercialLocalStorage().
export const AUTH_ACCESS_KEY = 'auth.access';
export const AUTH_REFRESH_KEY = 'auth.refresh';
export const AUTH_SESSION_KEY = 'auth.session';

// Instância sem interceptors para evitar loop circular.
const authAxios = axios.create({
  headers: { 'ngrok-skip-browser-warning': 'true' },
});

export interface UserSession {
  cpf: string;
  nome: string;
  email: string;
  cargo: string;
  departamento: string;
  role: 'ADMIN' | 'USER';
  is_superuser: boolean;
  permissoes: Record<string, boolean>;
}

export function getStoredTokens() {
  return {
    access: localStorage.getItem(AUTH_ACCESS_KEY),
    refresh: localStorage.getItem(AUTH_REFRESH_KEY),
  };
}

export function storeTokens(access: string, refresh: string) {
  localStorage.setItem(AUTH_ACCESS_KEY, access);
  localStorage.setItem(AUTH_REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(AUTH_ACCESS_KEY);
  localStorage.removeItem(AUTH_REFRESH_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export function getStoredSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(session: UserSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function buildSession(user: any): UserSession {
  return {
    cpf: user.cpf ?? '',
    nome: user.nome || user.first_name || 'Usuário',
    email: user.email || '',
    cargo: user.cargo || '',
    departamento: user.departamento || '',
    role: user.is_superuser ? 'ADMIN' : 'USER',
    is_superuser: !!user.is_superuser,
    permissoes: {},
  };
}

export async function login(cpf: string, password: string): Promise<UserSession> {
  // /token/ fica na raiz do Django, não sob /comercial/.
  const { data } = await authAxios.post('/token/', { cpf, password });

  storeTokens(data.access, data.refresh);

  // Busca dados completos do usuário autenticado.
  let user: any;
  try {
    const meRes = await authAxios.get('/comercial/usuarios/me/', {
      headers: { Authorization: `Bearer ${data.access}` },
    });
    user = meRes.data;
  } catch {
    user = { cpf, nome: cpf, is_superuser: false };
  }

  const session = buildSession(user);
  storeSession(session);
  return session;
}

export async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = getStoredTokens();
  if (!refresh) return null;

  try {
    const { data } = await authAxios.post('/token/refresh/', { refresh });
    storeTokens(data.access, data.refresh ?? refresh);
    return data.access;
  } catch {
    // Não limpa a sessão aqui: o chamador decide o que fazer.
    return null;
  }
}

export async function fetchUsuarios(): Promise<any[]> {
  const { access } = getStoredTokens();
  const { data } = await authAxios.get('/comercial/usuarios/', {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function createUsuario(payload: any): Promise<any> {
  const { access } = getStoredTokens();
  const { data } = await authAxios.post('/comercial/usuarios/', payload, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  return data;
}

export async function updateUsuario(cpf: string, payload: any): Promise<any> {
  const { access } = getStoredTokens();
  const { data } = await authAxios.patch(`/comercial/usuarios/${encodeURIComponent(cpf)}/`, payload, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  return data;
}

export async function deleteUsuario(cpf: string): Promise<void> {
  const { access } = getStoredTokens();
  await authAxios.delete(`/comercial/usuarios/${encodeURIComponent(cpf)}/`, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
}

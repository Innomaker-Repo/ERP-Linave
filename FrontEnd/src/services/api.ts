import axios, { AxiosInstance } from "axios";
import { getBackendBaseUrl } from "./network";
import { AUTH_ACCESS_KEY, AUTH_REFRESH_KEY, AUTH_SESSION_KEY } from "./authService";

const api: AxiosInstance = axios.create({
  baseURL: getBackendBaseUrl(),
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

// Injeta o token Bearer apenas quando há uma sessão ativa.
// Se não há sessão (auth.session = null), não envia o header para evitar
// que tokens antigos/inválidos causem 401 em rotas AllowAny.
api.interceptors.request.use((config) => {
  const session = localStorage.getItem(AUTH_SESSION_KEY);
  const token = localStorage.getItem(AUTH_ACCESS_KEY);
  if (session && token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

// Quando o access token expirar (401), tenta renovar com o refresh token.
// NÃO apaga a sessão nem redireciona — apenas rejeita o erro se o refresh
// também falhar, para não derrubar o login em recarregamentos de página.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;
    const refresh = localStorage.getItem(AUTH_REFRESH_KEY);

    if (!refresh) {
      // Sem refresh token: sessão inválida, força logout limpo.
      _forceLogout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Outra requisição já está renovando o token; aguarda.
      return new Promise((resolve, reject) => {
        pendingRequests.push((newToken) => {
          original.headers["Authorization"] = `Bearer ${newToken}`;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post("/token/refresh/", { refresh });
      const newAccess: string = data.access;
      localStorage.setItem(AUTH_ACCESS_KEY, newAccess);
      if (data.refresh) localStorage.setItem(AUTH_REFRESH_KEY, data.refresh);

      // Resolve todas as requisições que estavam aguardando.
      pendingRequests.forEach((cb) => cb(newAccess));
      pendingRequests = [];

      original.headers["Authorization"] = `Bearer ${newAccess}`;
      return api(original);
    } catch {
      // Refresh falhou: tokens definitivamente inválidos.
      pendingRequests = [];
      _forceLogout();
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

function _forceLogout() {
  localStorage.removeItem(AUTH_ACCESS_KEY);
  localStorage.removeItem(AUTH_REFRESH_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
  window.location.href = "/";
}

export default api;

import axios, { AxiosInstance } from "axios";
import { getBackendBaseUrl } from "./network";

const api: AxiosInstance = axios.create({
  baseURL: getBackendBaseUrl(),
  
  // Diz ao navegador para enviar automaticamente os cookies seguros 
  // (Session e CSRF) em todas as requisições para o Django
  withCredentials: true,
  
  // gerencia automaticamente o token de proteção CSRF do Django
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  
  headers: {
    // Cabeçalhos globais adicionais para todas as requisições
  },
});

export default api;
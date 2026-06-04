import axios, { AxiosInstance } from "axios";
import { getBackendBaseUrl } from "./network";

const api: AxiosInstance = axios.create({
  baseURL: getBackendBaseUrl(),
  headers: {
    // Evita la página de advertencia interstitial de ngrok en las
    // peticiones XHR (inofensivo cuando no se usa ngrok).
    "ngrok-skip-browser-warning": "true",
  },
});

export default api;
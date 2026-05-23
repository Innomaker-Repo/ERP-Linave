import axios, { AxiosInstance } from "axios";
import { getBackendBaseUrl } from "./network";

const api: AxiosInstance = axios.create({
  baseURL: getBackendBaseUrl(),
});

export default api;
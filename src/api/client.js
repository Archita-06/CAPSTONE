import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://172.26.83.44:8081";

export const TOKEN_KEY = "ra_access_token";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

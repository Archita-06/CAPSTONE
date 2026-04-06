import axios from "axios";
import { getApiBaseUrl } from "../config/runtime";

const baseURL = getApiBaseUrl();

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

const DEFAULT_LOCAL_API_URL = "http://localhost:8081";
const DEFAULT_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl) {
    return trimTrailingSlash(envUrl);
  }

  if (typeof window !== "undefined" && !isLocalHostname(window.location.hostname)) {
    return trimTrailingSlash(window.location.origin);
  }

  return DEFAULT_LOCAL_API_URL;
}

export function getSignalingUrl() {
  const envUrl = import.meta.env.VITE_SIGNALING_URL?.trim();
  if (envUrl) {
    return trimTrailingSlash(envUrl);
  }

  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl.startsWith("https://")) {
    return `${apiBaseUrl.replace("https://", "wss://")}/signaling`;
  }
  if (apiBaseUrl.startsWith("http://")) {
    return `${apiBaseUrl.replace("http://", "ws://")}/signaling`;
  }
  return `${DEFAULT_LOCAL_API_URL.replace("http://", "ws://")}/signaling`;
}

export function getIceServers() {
  const rawValue = import.meta.env.VITE_ICE_SERVERS?.trim();
  if (!rawValue) {
    return DEFAULT_ICE_SERVERS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

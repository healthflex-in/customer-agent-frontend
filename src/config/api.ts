import { resolveRuntimeEndpoints } from "./policy";

const endpoints = resolveRuntimeEndpoints(import.meta.env);

export const API_CONFIG = {
  APP_ENV: endpoints.APP_ENV,
  API_URL: endpoints.API_URL,
  WS_URL: endpoints.WS_URL,
  GRAPHQL_URL: endpoints.GRAPHQL_URL,
  CONSENT_URL: endpoints.CONSENT_URL,
};

export const getApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${API_CONFIG.API_URL}/`).href;
};

export const getWsUrl = (path: string = '/ws'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${API_CONFIG.WS_URL}/`).href;
};

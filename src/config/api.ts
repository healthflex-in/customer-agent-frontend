/**
 * API Configuration
 *
 * Development:  calls go directly to http://13.204.235.217:8001 (dev container)
 * Production:   calls go to the same origin (e.g. https://customerai.stance.health)
 *               and Vercel rewrites them to the backend via vercel.json proxy rules.
 *               This avoids all mixed-content browser blocks.
 */

const isDev = import.meta.env.DEV;
const DEV_BACKEND = 'http://13.204.235.217:8001';   // dev container
const PROD_BACKEND = 'http://13.204.235.217:8000';  // prod container

// In production, use empty string so URLs are relative to the page origin.
// Vercel's rewrite rules (vercel.json) forward them to the real backend.
const API_BASE = isDev
  ? (import.meta.env.VITE_API_URL ?? DEV_BACKEND)
  : '';

// WebSocket must be an absolute URL with the right protocol.
// Vercel cannot proxy WebSocket connections (only HTTP rewrites work), so in
// production we connect directly to the EC2 nginx domain that has wss:// configured.
function resolveWsBase(): string {
  // Always respect explicit env override first
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  // Local dev → dev container on port 8001
  if (isDev) return 'ws://13.204.235.217:8001';
  // Production: bypass Vercel — connect directly to the EC2 backend
  return 'wss://customeragent.stance.health';
}

// Suppress unused-variable warning — kept as a named constant for clarity
void PROD_BACKEND;

export const API_CONFIG = {
  API_URL: API_BASE,
  WS_URL: resolveWsBase(),
};

export const getApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.API_URL}${normalizedPath}`;
};

export const getWsUrl = (path: string = '/ws'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.WS_URL}${normalizedPath}`;
};

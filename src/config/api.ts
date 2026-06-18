/**
 * API Configuration
 *
 * Development:  calls go directly to http://13.204.235.217:8000
 * Production:   calls go to the same origin (e.g. https://customerai.stance.health)
 *               and Vercel rewrites them to the backend via vercel.json proxy rules.
 *               This avoids all mixed-content browser blocks.
 */

const isDev = import.meta.env.DEV;
const DEV_BACKEND = 'http://13.204.235.217:8000';

// In production, use empty string so URLs are relative to the page origin.
// Vercel's rewrite rules (vercel.json) forward them to the real backend.
const API_BASE = isDev ? DEV_BACKEND : '';

// WebSocket must be an absolute URL with the right protocol.
// In production, derive it from the page origin (https → wss, http → ws).
function resolveWsBase(): string {
  if (isDev) return 'ws://13.204.235.217:8000';
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}`;
  }
  return 'ws://localhost:8080';
}

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

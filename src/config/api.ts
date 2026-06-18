/**
 * API Configuration
 *
 * Priority order for URLs:
 *   1. VITE_API_URL / VITE_WS_URL environment variables (set in Vercel dashboard)
 *   2. Auto-detect from current page protocol:
 *        https → https:// + wss://
 *        http  → http://  + ws://
 *
 * Set these in Vercel → Project Settings → Environment Variables:
 *   VITE_API_URL = https://api.customerai.stance.health
 *   VITE_WS_URL  = wss://api.customerai.stance.health
 */

const RAW_BACKEND = 'http://13.204.235.217:8000';

// If an explicit env var is set, use it. Otherwise derive https/wss automatically
// based on the page protocol so mixed-content errors never happen in production.
function resolveApiUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    // Replace http:// with https:// for same backend (requires SSL on server)
    return RAW_BACKEND.replace('http://', 'https://');
  }
  return RAW_BACKEND;
}

function resolveWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return RAW_BACKEND.replace('http://', 'wss://');
  }
  return RAW_BACKEND.replace('http://', 'ws://');
}

export const API_CONFIG = {
  API_URL: resolveApiUrl(),
  WS_URL: resolveWsUrl(),
};

export const getApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.API_URL}${normalizedPath}`;
};

export const getWsUrl = (path: string = '/ws'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.WS_URL}${normalizedPath}`;
};

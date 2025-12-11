/**
 * API Configuration
 * 
 * This file centralizes all API and WebSocket URLs.
 * It uses environment variables from Vite (VITE_*) with fallbacks.
 * 
 * For development: Uses localhost:8000
 * For production: Uses customeragent.stance.health
 * 
 * To override these values:
 * 1. Create .env.development for local development
 * 2. Create .env.production for production builds
 * 
 * Example .env.production:
 * VITE_API_URL=https://customeragent.stance.health
 * VITE_WS_URL=wss://customeragent.stance.health
 */

const isDevelopment = import.meta.env.DEV;

// Default URLs based on environment
const DEFAULT_API_URL = isDevelopment 
  ? 'http://localhost:8082' 
  : 'https://customeragent.stance.health';

const DEFAULT_WS_URL = isDevelopment 
  ? 'ws://localhost:8082' 
  : 'wss://customeragent.stance.health';

// Export configuration with environment variable overrides
export const API_CONFIG = {
  // Base API URL for HTTP requests
  API_URL: import.meta.env.VITE_API_URL || DEFAULT_API_URL,
  
  // WebSocket URL for real-time connections
  WS_URL: import.meta.env.VITE_WS_URL || DEFAULT_WS_URL,
} as const;

// Helper function to build API endpoints
export const getApiUrl = (path: string): string => {
  const url = API_CONFIG.API_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${url}${normalizedPath}`;
};

// Helper function to build WebSocket URLs
export const getWsUrl = (path: string = '/ws'): string => {
  const url = API_CONFIG.WS_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${url}${normalizedPath}`;
};


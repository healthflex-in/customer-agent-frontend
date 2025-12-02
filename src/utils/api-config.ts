export const API_KEY =
  import.meta.env.VITE_API_KEY ||
  '43a18685ac5bc82b8d75c81d76ff3332af47870e22556a42470b7ca8993d0e7c';

export const API_URL =
  import.meta.env.VITE_API_URL || 'https://api.stance.health/graphql';

export function getApiUrl(): string {
  return API_URL;
}


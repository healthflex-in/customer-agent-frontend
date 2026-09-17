import { API_CONFIG } from "@/config/api";

function requirePublicConfig(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required public configuration: ${name}. ` +
      "Provide it through the deployment environment; do not add a source-code fallback.",
    );
  }
  return value;
}

// These values are delivered to the browser. The API must treat the key as a
// restricted application identifier, never as user identity or a server secret.
export const GRAPHQL_BROWSER_API_KEY = requirePublicConfig("VITE_API_KEY");
export const ORGANIZATION_ID = requirePublicConfig("VITE_ORGANIZATION_ID");

// GraphQL is on the main Healthflex API — separate from the customer-agent backend
export const API_URL = API_CONFIG.GRAPHQL_URL;

if (!API_URL) {
  throw new Error("Missing required public configuration: VITE_GRAPHQL_URL");
}

export function getApiUrl(): string {
  return API_URL;
}

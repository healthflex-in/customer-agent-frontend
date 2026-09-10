export type AppEnvironment = "local" | "development" | "staging" | "production";

export interface PublicEnvironment {
  VITE_APP_ENV?: string;
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
  VITE_GRAPHQL_URL?: string;
  VITE_CONSENT_URL?: string;
  VITE_ALLOW_INSECURE_DEV_IP?: string;
}

export interface RuntimeEndpoints {
  APP_ENV: AppEnvironment;
  API_URL: string;
  WS_URL: string;
  GRAPHQL_URL?: string;
  CONSENT_URL: string;
}

const APP_ENVIRONMENTS = new Set<AppEnvironment>([
  "local",
  "development",
  "staging",
  "production",
]);

const PRODUCTION_HOSTS = new Set([
  "customerai.stance.health",
  "customeragent.stance.health",
  "api.stance.health",
  "consent.stance.health",
]);

const NON_PRODUCTION_HOSTS = new Set([
  "dev.customerai.stance.health",
  "dev.customeragent.stance.health",
  "devapi.stance.health",
  "dev.consent.stance.health",
  "staging.customeragent.stance.health",
]);

function requireValue(env: PublicEnvironment, name: keyof PublicEnvironment): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required public configuration: ${name}`);
  }
  return value;
}

function parseEndpoint(
  name: keyof PublicEnvironment,
  rawValue: string,
  allowedProtocols: Set<string>,
  allowedPath: (pathname: string) => boolean,
): URL {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (!allowedProtocols.has(url.protocol)) {
    throw new Error(`${name} uses unsupported protocol ${url.protocol}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not include credentials, query parameters, or fragments`);
  }
  if (!allowedPath(url.pathname)) {
    throw new Error(`${name} contains an unexpected path: ${url.pathname}`);
  }
  return url;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isIpv4Hostname(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  return (
    octets.length === 4 &&
    octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  );
}

function assertEnvironmentHost(
  name: keyof PublicEnvironment,
  url: URL,
  appEnv: AppEnvironment,
): void {
  const hostname = url.hostname.toLowerCase();
  if (appEnv === "local") {
    if ((name === "VITE_API_URL" || name === "VITE_WS_URL") && !isLocalHostname(hostname)) {
      throw new Error(`${name} must use localhost when VITE_APP_ENV=local`);
    }
    if (PRODUCTION_HOSTS.has(hostname)) {
      throw new Error(`${name} points a local build at production: ${hostname}`);
    }
    return;
  }

  if (appEnv !== "production" && PRODUCTION_HOSTS.has(hostname)) {
    throw new Error(`${name} points a non-production build at production: ${hostname}`);
  }
  if (
    appEnv === "production" &&
    (isLocalHostname(hostname) || isPrivateIpv4(hostname) || NON_PRODUCTION_HOSTS.has(hostname))
  ) {
    throw new Error(`${name} points a production build at a non-production host: ${hostname}`);
  }
}

function normalizedOrigin(url: URL): string {
  return url.origin;
}

export function resolveRuntimeEndpoints(env: PublicEnvironment): RuntimeEndpoints {
  const rawAppEnv = requireValue(env, "VITE_APP_ENV");
  if (!APP_ENVIRONMENTS.has(rawAppEnv as AppEnvironment)) {
    throw new Error(
      "VITE_APP_ENV must be one of local, development, staging, or production",
    );
  }
  const appEnv = rawAppEnv as AppEnvironment;
  const allowInsecureDevIp =
    env.VITE_ALLOW_INSECURE_DEV_IP?.trim().toLowerCase() === "true";
  if (allowInsecureDevIp && appEnv !== "development") {
    throw new Error(
      "VITE_ALLOW_INSECURE_DEV_IP is permitted only when VITE_APP_ENV=development",
    );
  }

  const apiUrl = parseEndpoint(
    "VITE_API_URL",
    requireValue(env, "VITE_API_URL"),
    new Set(["http:", "https:"]),
    (path) => path === "/",
  );
  const wsUrl = parseEndpoint(
    "VITE_WS_URL",
    requireValue(env, "VITE_WS_URL"),
    new Set(["ws:", "wss:"]),
    (path) => path === "/",
  );
  const consentUrl = parseEndpoint(
    "VITE_CONSENT_URL",
    requireValue(env, "VITE_CONSENT_URL"),
    new Set(["https:"]),
    (path) => path === "/",
  );

  const graphqlValue = env.VITE_GRAPHQL_URL?.trim();
  const graphqlUrl = graphqlValue
    ? parseEndpoint(
        "VITE_GRAPHQL_URL",
        graphqlValue,
        new Set(["https:"]),
        (path) => path === "/graphql",
      )
    : undefined;

  const entries: Array<[keyof PublicEnvironment, URL]> = [
    ["VITE_API_URL", apiUrl],
    ["VITE_WS_URL", wsUrl],
    ["VITE_CONSENT_URL", consentUrl],
  ];
  if (graphqlUrl) entries.push(["VITE_GRAPHQL_URL", graphqlUrl]);
  entries.forEach(([name, url]) => assertEnvironmentHost(name, url, appEnv));

  const insecureIpTransportAllowed =
    allowInsecureDevIp &&
    isIpv4Hostname(apiUrl.hostname) &&
    isIpv4Hostname(wsUrl.hostname) &&
    apiUrl.protocol === "http:" &&
    wsUrl.protocol === "ws:";

  if (appEnv !== "local" && apiUrl.protocol !== "https:" && !insecureIpTransportAllowed) {
    throw new Error("Deployed VITE_API_URL must use HTTPS");
  }
  if (appEnv !== "local" && wsUrl.protocol !== "wss:" && !insecureIpTransportAllowed) {
    throw new Error("Deployed VITE_WS_URL must use WSS");
  }

  return {
    APP_ENV: appEnv,
    API_URL: normalizedOrigin(apiUrl),
    WS_URL: normalizedOrigin(wsUrl),
    GRAPHQL_URL: graphqlUrl?.href,
    CONSENT_URL: normalizedOrigin(consentUrl),
  };
}

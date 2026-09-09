let inMemoryAccessToken: string | null = null;

function consumeFragmentToken(): string | null {
  if (typeof window === "undefined") return null;
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = fragment.get("access_token");
  if (!token) return null;

  fragment.delete("access_token");
  const remainingFragment = fragment.toString();
  const cleanUrl = `${window.location.pathname}${window.location.search}` +
    (remainingFragment ? `#${remainingFragment}` : "");
  window.history.replaceState(null, "", cleanUrl);
  window.sessionStorage.setItem("stance_access_token", token);
  return token;
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  inMemoryAccessToken = consumeFragmentToken();
  if (!inMemoryAccessToken && typeof window !== "undefined") {
    inMemoryAccessToken = window.sessionStorage.getItem("stance_access_token");
  }
  return inMemoryAccessToken;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("stance_access_token");
  }
}

export function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

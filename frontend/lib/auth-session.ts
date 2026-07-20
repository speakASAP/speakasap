const AUTH_SESSION_KEY = "speakasap.auth.tokens";
const AUTH_STATE_KEY_PREFIX = "speakasap.auth.return.";
const AUTH_CLIENT_ID = "speakasap";
const DEFAULT_AUTH_BASE_URL = "https://auth.alfares.cz";

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  expiresIn?: number;
  tokenType?: string;
  authMethod?: string;
  storedAt: number;
};

function authBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL).replace(/\/$/, "");
}

export function getAuthBaseUrl(): string {
  return authBaseUrl();
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function absoluteReturnUrl(returnPath: string): string {
  if (typeof window === "undefined") {
    return returnPath;
  }
  return new URL(returnPath || "/auth/callback", window.location.origin).toString();
}

function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function randomState(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildHostedAuthLoginUrl(returnPath = "/"): string {
  const state = randomState();
  const storage = browserStorage();
  storage?.setItem(`${AUTH_STATE_KEY_PREFIX}${state}`, safeReturnPath(returnPath || "/"));

  const callbackUrl = absoluteReturnUrl(`/auth/callback?state=${encodeURIComponent(state)}`);
  const url = new URL(`${authBaseUrl()}/login`);
  url.searchParams.set("client_id", AUTH_CLIENT_ID);
  url.searchParams.set("return_url", callbackUrl);
  url.searchParams.set("state", state);
  return url.toString();
}

export function getAuthSession(): AuthSession | null {
  const raw = browserStorage()?.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken.trim()) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
      expiresIn: typeof parsed.expiresIn === "number" ? parsed.expiresIn : undefined,
      tokenType: typeof parsed.tokenType === "string" ? parsed.tokenType : undefined,
      authMethod: typeof parsed.authMethod === "string" ? parsed.authMethod : undefined,
      storedAt: typeof parsed.storedAt === "number" ? parsed.storedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveAuthSession(session: Omit<AuthSession, "storedAt">): void {
  const accessToken = session.accessToken.trim();
  if (!accessToken) {
    return;
  }
  browserStorage()?.setItem(AUTH_SESSION_KEY, JSON.stringify({ ...session, accessToken, storedAt: Date.now() }));
}

export function clearAuthSession(): void {
  browserStorage()?.removeItem(AUTH_SESSION_KEY);
}

export function consumeHostedAuthFragment(locationLike: Location = window.location): { nextPath: string; stored: boolean; error?: string } {
  const params = new URLSearchParams(locationLike.hash.replace(/^#/, ""));
  const url = new URL(locationLike.href);
  const returnedState = params.get("state") || url.searchParams.get("state") || "";
  const storage = browserStorage();
  const stateKey = returnedState ? `${AUTH_STATE_KEY_PREFIX}${returnedState}` : "";
  const storedReturnPath = stateKey ? storage?.getItem(stateKey) : null;
  if (stateKey) {
    storage?.removeItem(stateKey);
  }

  if (!returnedState || !storedReturnPath) {
    return { nextPath: "/", stored: false, error: "invalid_state" };
  }

  const accessToken = params.get("access_token") || params.get("token");
  if (!accessToken) {
    return { nextPath: safeReturnPath(storedReturnPath), stored: false, error: "missing_access_token" };
  }

  saveAuthSession({
    accessToken,
    refreshToken: params.get("refresh_token") || undefined,
    expiresAt: params.get("expires_at") || undefined,
    expiresIn: params.get("expires_in") ? Number(params.get("expires_in")) : undefined,
    tokenType: params.get("token_type") || undefined,
    authMethod: params.get("auth_method") || undefined,
  });
  return { nextPath: safeReturnPath(storedReturnPath), stored: true };
}

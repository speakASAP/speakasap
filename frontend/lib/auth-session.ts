const AUTH_SESSION_KEY = "speakasap.auth.tokens";
const AUTH_STATE_KEY_PREFIX = "speakasap.auth.return.";
const AUTH_CLIENT_ID = "speakasap";
const DEFAULT_AUTH_BASE_URL = "https://auth.alfares.cz";

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  storedAt: number;
};

function authBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL).replace(/\/$/, "");
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

function randomState(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildHostedAuthLoginUrl(returnPath = "/"): string {
  const state = randomState();
  const storage = browserStorage();
  storage?.setItem(`${AUTH_STATE_KEY_PREFIX}${state}`, returnPath || "/");

  const callbackUrl = absoluteReturnUrl(`/auth/callback?state=${encodeURIComponent(state)}`);
  const url = new URL(`${authBaseUrl()}/login`);
  url.searchParams.set("client_id", AUTH_CLIENT_ID);
  url.searchParams.set("return_url", callbackUrl);
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
      expiresIn: typeof parsed.expiresIn === "number" ? parsed.expiresIn : undefined,
      tokenType: typeof parsed.tokenType === "string" ? parsed.tokenType : undefined,
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
  const accessToken = params.get("access_token") || params.get("token");
  const refreshToken = params.get("refresh_token") || undefined;
  const expiresIn = params.get("expires_in");
  const tokenType = params.get("token_type") || undefined;
  const state = new URL(locationLike.href).searchParams.get("state") || "";
  const storage = browserStorage();
  const stateKey = state ? `${AUTH_STATE_KEY_PREFIX}${state}` : "";
  const nextPath = (stateKey && storage?.getItem(stateKey)) || "/";
  if (stateKey) {
    storage?.removeItem(stateKey);
  }

  if (!accessToken) {
    return { nextPath, stored: false, error: "missing_access_token" };
  }

  saveAuthSession({
    accessToken,
    refreshToken,
    expiresIn: expiresIn ? Number(expiresIn) : undefined,
    tokenType,
  });
  return { nextPath, stored: true };
}

import { getAuthSession } from "@/lib/auth-session";
import { getGatewayBaseUrl } from "@/lib/gateway";
import { redirectToLogin } from "@/lib/auth-redirect";

export type GatewayMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type GatewayRequest = {
  path: string;
  method?: GatewayMethod;
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * Keep a 401 as an ordinary result instead of redirecting to login.
   *
   * For the diagnostic consoles (`/admin`, the lesson-record workspace), whose whole
   * purpose is to show what a gateway route answered — navigating away on 401 would
   * destroy the very answer the operator opened the page to read.
   *
   * Everything else wants the redirect: a 401 there is a dead session on a page that
   * cannot render, and the only thing that fixes it is signing in again.
   */
  keepUnauthorized?: boolean;
};

function gatewayUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export type GatewayResponse = {
  ok: boolean;
  status: number;
  data: unknown;
  contentType: string;
  /**
   * Set when this 401 has already been answered by redirecting to login, so the caller
   * should render nothing — the page is navigating away, and an error box painted over it
   * tells the user their request failed when only their session expired.
   */
  redirectingToLogin?: boolean;
};

export async function callGateway(request: GatewayRequest): Promise<GatewayResponse> {
  const baseUrl = getGatewayBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      status: 0,
      contentType: "application/json",
      data: { error: { code: "GATEWAY_NOT_CONFIGURED", message: "NEXT_PUBLIC_API_URL is missing" } },
    };
  }

  const headers: Record<string, string> = { ...(request.headers ?? {}) };
  if (request.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const explicitToken = request.token?.trim() ?? "";
  const sessionToken = explicitToken || getAuthSession()?.accessToken || "";
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const response = await fetch(gatewayUrl(baseUrl, request.path), {
    method: request.method ?? "GET",
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let payload: unknown = { raw: text };
  if (contentType.includes("application/json") && text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  } else if (!text) {
    payload = { raw: "", contentLength: response.headers.get("content-length") };
  }

  if (response.status === 401 && !request.keepUnauthorized) {
    // The session is dead and no page can recover from that on its own, so the browser
    // goes to login and returns to this same URL. This happens AFTER the body is read so
    // the result below stays well-formed for any caller still holding the promise —
    // `assign` does not halt the JavaScript that called it.
    redirectToLogin();
    return {
      ok: false,
      status: 401,
      contentType,
      data: payload,
      redirectingToLogin: true,
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    data: payload,
  };
}

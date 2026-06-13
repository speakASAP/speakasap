import { getGatewayBaseUrl } from "@/lib/gateway";

export type GatewayMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type GatewayRequest = {
  path: string;
  method?: GatewayMethod;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

function gatewayUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export async function callGateway(request: GatewayRequest): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
  contentType: string;
}> {
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
  const token = request.token?.trim() ?? "";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
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

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    data: payload,
  };
}

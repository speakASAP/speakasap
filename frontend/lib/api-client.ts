import { getGatewayBaseUrl } from "@/lib/gateway";

export type GatewayMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type GatewayRequest = {
  path: string;
  method?: GatewayMethod;
  token?: string;
  body?: unknown;
};

export async function callGateway(request: GatewayRequest): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
}> {
  const baseUrl = getGatewayBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      status: 0,
      data: { error: { code: "GATEWAY_NOT_CONFIGURED", message: "NEXT_PUBLIC_API_URL is missing" } },
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = request.token?.trim() ?? "";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${request.path}`, {
    method: request.method ?? "GET",
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = { raw: await response.text() };
  }

  return {
    ok: response.ok,
    status: response.status,
    data: payload,
  };
}

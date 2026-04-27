const gatewayBaseUrl = process.env.NEXT_PUBLIC_API_URL;

export function getGatewayBaseUrl(): string | null {
  if (!gatewayBaseUrl) {
    return null;
  }
  return gatewayBaseUrl.replace(/\/$/, "");
}

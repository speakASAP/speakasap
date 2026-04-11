export function buildPublicAssetUrl(relativePath: string): string {
  const base = (process.env.MATERIALS_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const path = relativePath.replace(/^\/+/, '');
  return `${base}/${path}`;
}

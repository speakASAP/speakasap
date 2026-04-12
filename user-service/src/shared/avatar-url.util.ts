export function buildAvatarUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) {
    return null;
  }
  const base = process.env.MATERIALS_BASE_URL?.replace(/\/$/, '');
  if (!base) {
    return storageKey;
  }
  return `${base}/${storageKey.replace(/^\//, '')}`;
}

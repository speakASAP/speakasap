export function minorFromTotalsString(s: string | undefined): number {
  if (!s) {
    return 0;
  }
  const n = Number(String(s).replace(',', '.'));
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.round(n * 100);
}

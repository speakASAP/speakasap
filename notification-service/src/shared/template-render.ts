/** Replace `{{key}}` placeholders; missing keys → empty string. */
export function renderTemplateHtml(bodyHtml: string, context: Record<string, unknown>): string {
  return bodyHtml.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey: string) => {
    const key = String(rawKey).trim();
    const v = context[key];
    if (v === undefined || v === null) {
      return '';
    }
    if (typeof v === 'object') {
      return '';
    }
    return String(v);
  });
}

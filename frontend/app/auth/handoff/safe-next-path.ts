/**
 * Reduces a caller-supplied `next` value to a same-origin path, or `/`.
 *
 * An open-redirect guard. `startsWith('/')` is not sufficient on its own: `//evil.example`
 * and `/\evil.example` both pass that check and both are treated by browsers as absolute
 * URLs to another host. Parsing against a dummy origin and keeping only the path means
 * anything that resolves off-origin is discarded rather than pattern-matched.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') {
    return '/';
  }

  const value = next.trim();
  if (!value.startsWith('/')) {
    // Absolute URLs, scheme-relative values and `javascript:` all land here.
    return '/';
  }
  // `//host` and `/\host` are absolute in a browser despite the leading slash.
  if (value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }

  try {
    const parsed = new URL(value, 'https://placeholder.invalid');
    if (parsed.origin !== 'https://placeholder.invalid') {
      return '/';
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

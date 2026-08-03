/**
 * Shared rendering helpers for the drill emails.
 *
 * Everything interpolated into these templates is attacker-influenced somewhere: a
 * student name comes from a profile, a title and a topic name from teacher free text, a
 * sentence from a model. All of it is escaped, including URLs, which land inside an
 * href where an unescaped quote breaks out of the attribute.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Supported material languages. Anything else falls back to English. */
export type Copy<T> = { ru: T; en: T };

export function pickCopy<T>(copy: Copy<T>, materialLanguage: string): T {
  return materialLanguage === 'ru' ? copy.ru : copy.en;
}

/**
 * A date a human reads, not an ISO timestamp. An email that says
 * "2026-08-05T00:00:00.000Z" reads as a bug to the student receiving it.
 */
export function formatDate(iso: string, materialLanguage: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(materialLanguage === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Escaping alone makes a URL safe *as an attribute value* — `&quot;` cannot break out of
 * the href — but it says nothing about the scheme. `javascript:alert(1)` survives
 * escaping intact and renders as a live link in any client that honours it. Only http
 * and https are allowed through; anything else renders as inert text.
 */
export function safeUrl(url: string): string | null {
  const trimmed = String(url ?? '').trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

export function linkHtml(url: string, label: string): string {
  const safe = safeUrl(url);
  if (!safe) {
    return escapeHtml(label);
  }
  return `<a href="${escapeHtml(safe)}">${escapeHtml(label)}</a>`;
}

export function topicLinksHtml(topics: { topic: string; url: string }[]): string {
  if (topics.length === 0) {
    return '';
  }
  const items = topics.map((t) => `<li>${linkHtml(t.url, t.topic)}</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function topicLinksText(topics: { topic: string; url: string }[]): string {
  return topics.map((t) => `- ${t.topic}: ${t.url}`).join('\n');
}

/** Drops empty sections rather than rendering a blank line or a stray label. */
export function joinSections(sections: (string | null | undefined)[], separator: string): string {
  return sections.filter((s): s is string => Boolean(s && s.trim())).join(separator);
}

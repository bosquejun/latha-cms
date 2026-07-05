/**
 * Zero-dependency slug primitives.
 *
 * `slugify` folds a single path segment to kebab-case; `slugifyPath` applies
 * it per `/`-separated segment so templated slugs like
 * `{publishedAt:yyyy}/{title}` → `2026/hello-world` stay path-shaped.
 * Scripts NFKD can't reduce to ASCII (CJK, etc.) fold to `''` — callers treat
 * an empty result as "no slug" and leave the field for manual input.
 */

// Latin letters NFKD leaves intact (they're letters, not decompositions).
const LATIN_EXTRAS: Record<string, string> = {
  \u00e6: 'ae',
  \u0153: 'oe',
  \u00f8: 'o',
  \u0111: 'd',
  \u00f0: 'd',
  \u00fe: 'th',
  \u00df: 'ss',
  \u0142: 'l',
  \u0127: 'h',
  \u014b: 'ng',
}

/** Kebab-case one path segment: NFKD-fold accents, lowercase, squash runs. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u00e6\u0153\u00f8\u0111\u00f0\u00fe\u00df\u0142\u0127\u014b]/g, (c) => LATIN_EXTRAS[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Kebab-case each `/` segment independently, dropping empty segments. */
export function slugifyPath(input: string): string {
  return input
    .split('/')
    .map(slugify)
    .filter((segment) => segment.length > 0)
    .join('/')
}

/** One or more kebab-case segments joined by `/` — the stored slug shape. */
export const SLUG_PATH_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/

/**
 * Format a date with `yyyy`/`MM`/`dd`/`HH`/`mm`/`ss` tokens, in UTC so a
 * generated slug never depends on the server's timezone. Returns `''` for
 * unparseable input — the segment simply drops out of the slug.
 */
export function formatDate(value: unknown, pattern: string): string {
  const date =
    value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return pattern
    .replace(/yyyy/g, String(date.getUTCFullYear()))
    .replace(/MM/g, pad(date.getUTCMonth() + 1))
    .replace(/dd/g, pad(date.getUTCDate()))
    .replace(/HH/g, pad(date.getUTCHours()))
    .replace(/mm/g, pad(date.getUTCMinutes()))
    .replace(/ss/g, pad(date.getUTCSeconds()))
}

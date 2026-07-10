/**
 * Prefix a bare host (`example.com`) with https:// so links resolve. Leaves
 * absolute URLs, anchors, mailto/tel, and root-relative paths untouched.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed === '') return ''
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

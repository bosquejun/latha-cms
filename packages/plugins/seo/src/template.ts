/**
 * Tiny sibling-field template resolver, shared by the derivation hooks
 * (server) and the Studio preview (client) so both interpret a `from` template
 * identically.
 *
 * A template is plain text with `{fieldName}` tokens that resolve against the
 * document's top-level sibling fields — `'{title}'`, `'{title} — {category}'`.
 * Deliberately simpler than `@kon10/slug`'s compiler: SEO derivation only ever
 * fills empty text, never a URL path, so there is no normalization, no date
 * formatting, and no related-doc traversal to compile here.
 */

/** Field names referenced by `{token}`s in a template, in order of appearance. */
export function templateTokens(template: string): string[] {
  const names: string[] = []
  for (const match of template.matchAll(/\{([^}]+)\}/g)) {
    const name = match[1]!.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

/**
 * Substitute `{field}` tokens with sibling values. A missing/nullish value
 * renders empty; the whole result is trimmed and internal whitespace is
 * collapsed so a template whose tokens all resolve empty yields `''` (the
 * hook then leaves the target untouched rather than storing blank text).
 */
export function resolveTemplate(template: string, doc: Record<string, unknown>): string {
  const filled = template.replace(/\{([^}]+)\}/g, (_, raw: string) => {
    const value = doc[raw.trim()]
    return value == null ? '' : String(value)
  })
  return filled.replace(/\s+/g, ' ').trim()
}

/**
 * Apply a site-wide title template such as `'%s · Acme'` to a resolved title.
 * A template without the `%s` placeholder is treated as a suffix-free constant
 * and returned as-is only when there is no title; with a title present and no
 * placeholder, the title wins (never silently discard the page's own title).
 */
export function applyTitleTemplate(title: string, template?: string): string {
  if (!template) return title
  if (!template.includes('%s')) return title || template
  return template.replace('%s', title)
}

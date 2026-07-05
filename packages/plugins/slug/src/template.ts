/**
 * Slug templates — the `from` grammar and its compiled-token form.
 *
 * A template interleaves literal text with `{...}` tokens:
 *
 *   '{title}'                          sibling field
 *   '{publishedAt:yyyy}/{title}'       sibling field with a date format
 *   '{category.slug}/{title}'          related entity's field (one db lookup)
 *   'blog/{title}'                     literal segment
 *
 * A bare field name (`from: 'title'`) is sugar for `'{title}'`.
 *
 * Templates are parsed once — `slugPlugin` compiles them at `onInit`, when
 * the sibling fields are known, and stamps the result onto the field config
 * (`tokens`). Ref tokens get `via` (the target entity's slug) resolved from
 * the sibling relationship/taxonomy/media field, so both the server hook and
 * the admin renderer can interpret the same tokens without re-deriving
 * anything. `resolveTokens` renders the raw string; callers `slugifyPath` it.
 */

import { z } from 'zod'
import { formatDate } from './slugify.js'

export const slugTokenSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literal'), text: z.string() }),
  z.object({
    kind: z.literal('field'),
    /** Sibling field name whose value fills this token. */
    name: z.string(),
    /** Date format (yyyy/MM/dd/HH/mm/ss) applied to date-like values. */
    format: z.string().optional(),
  }),
  z.object({
    kind: z.literal('ref'),
    /** Sibling relationship/taxonomy/media field holding the reference id. */
    name: z.string(),
    /** Property read off the referenced document (e.g. 'slug', 'name'). */
    path: z.string(),
    /** Slug of the entity the reference points at — resolved at compile time. */
    via: z.string(),
    format: z.string().optional(),
  }),
])

export type SlugToken = z.infer<typeof slugTokenSchema>

/** A parsed-but-uncompiled token: ref targets (`via`) are not yet resolved. */
export type RawSlugToken =
  | { kind: 'literal'; text: string }
  | { kind: 'field'; name: string; format?: string }
  | { kind: 'rawref'; name: string; path: string; format?: string }

const TOKEN_RE = /\{([^{}]+)\}/g

/** Parse a `from` template into raw tokens. Bare field names are `{name}`. */
export function parseTemplate(template: string): RawSlugToken[] {
  if (!template.includes('{')) {
    return [{ kind: 'field', name: template.trim() }]
  }

  const tokens: RawSlugToken[] = []
  let last = 0
  for (const match of template.matchAll(TOKEN_RE)) {
    if (match.index > last) {
      tokens.push({ kind: 'literal', text: template.slice(last, match.index) })
    }
    const body = match[1]!.trim()
    const colon = body.indexOf(':')
    const ref = colon === -1 ? body : body.slice(0, colon)
    const format = colon === -1 ? undefined : body.slice(colon + 1).trim()
    const dot = ref.indexOf('.')
    if (dot === -1) {
      tokens.push({ kind: 'field', name: ref.trim(), format })
    } else {
      tokens.push({
        kind: 'rawref',
        name: ref.slice(0, dot).trim(),
        path: ref.slice(dot + 1).trim(),
        format,
      })
    }
    last = match.index + match[0].length
  }
  if (last < template.length) {
    tokens.push({ kind: 'literal', text: template.slice(last) })
  }
  return tokens
}

/**
 * Resolve raw tokens against the entity's fields: verify each named sibling
 * exists and, for ref tokens, derive `via` from the sibling's target (`to` on
 * relationship/taxonomy fields; `media` fields implicitly target `media`).
 * Throws at boot on a template that names a missing or non-reference field —
 * a config error, surfaced early.
 */
export function compileTokens(
  raw: RawSlugToken[],
  fields: Array<Record<string, unknown>>,
  context: string,
): SlugToken[] {
  const byName = new Map(fields.map((f) => [f.name as string, f]))

  return raw.map((token): SlugToken => {
    if (token.kind === 'literal') return token

    const sibling = byName.get(token.name)
    if (!sibling) {
      throw new Error(
        `Slug template in ${context} references unknown field "${token.name}".`,
      )
    }

    if (token.kind === 'field') {
      return { kind: 'field', name: token.name, format: token.format }
    }

    const via =
      typeof sibling.to === 'string'
        ? sibling.to
        : sibling.type === 'media'
          ? 'media'
          : undefined
    if (!via) {
      throw new Error(
        `Slug template in ${context}: "${token.name}.${token.path}" traverses ` +
          `a "${String(sibling.type)}" field, which does not reference another entity.`,
      )
    }
    return { kind: 'ref', name: token.name, path: token.path, via, format: token.format }
  })
}

/** The db surface `resolveTokens` needs — structurally `DBAdapter.findOne`. */
export interface TokenDb {
  findOne(collection: string, id: string): Promise<Record<string, unknown> | null>
}

export interface TokenContext {
  data: Record<string, unknown>
  previousDoc?: Record<string, unknown>
  db: TokenDb
  /** Reserved for future localized slugs — unused in v1. */
  locale?: string
}

/** Render one token's value: date-format when asked, `''` for missing. */
export function renderTokenValue(value: unknown, format: string | undefined): string {
  if (value == null) return ''
  if (format) return formatDate(value, format)
  return String(value)
}

/**
 * Render compiled tokens to the raw (pre-`slugifyPath`) string. Missing
 * values render as `''` so their segments drop out rather than failing.
 * `many` reference fields use their first id.
 */
export async function resolveTokens(
  tokens: SlugToken[],
  ctx: TokenContext,
): Promise<string> {
  const parts: string[] = []
  for (const token of tokens) {
    if (token.kind === 'literal') {
      parts.push(token.text)
      continue
    }
    const value = ctx.data[token.name] ?? ctx.previousDoc?.[token.name]
    if (token.kind === 'field') {
      parts.push(renderTokenValue(value, token.format))
      continue
    }
    const id = Array.isArray(value) ? value[0] : value
    if (id == null || id === '') {
      parts.push('')
      continue
    }
    const doc = await ctx.db.findOne(token.via, String(id))
    parts.push(renderTokenValue(doc?.[token.path], token.format))
  }
  return parts.join('')
}

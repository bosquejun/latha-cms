/**
 * `slug` field renderer — a live slug input that follows its template.
 *
 * While unlocked it mirrors the compiled template (`field.tokens`) as the
 * writer types: sibling values come from `useFieldValue`, date tokens format
 * client-side, and ref tokens fetch the referenced doc through the RPC
 * client. Any manual keystroke locks the field (editing an existing doc
 * starts locked — retitling never rewrites a saved URL); the ↻ button
 * regenerates and resumes following. The server hook remains authoritative:
 * it re-normalizes and uniquifies (-2, -3…) on save.
 */
import { useEffect, useState } from 'react'
import { Button, Field as FieldWrap, Input, InputAddon, InputGroup } from '@latha/ui'
import { type FieldControlProps, humanize, useFieldValue } from '@latha/admin-sdk'
import { useLatha, useAsync, type JsonDoc } from '@latha/start'
import { slugifyPath } from '../../slugify.js'
import { renderTokenValue, type SlugToken } from '../../template.js'

export const config = { type: 'slug' }

/**
 * Refresh glyph for the regenerate button. Inlined (rather than pulling in an
 * icon dependency) so the slug plugin stays dependency-light; the Button sizes
 * it to `size-4` via its own `[&_svg]` rule.
 */
function RegenerateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

/** Lenient while-typing normalizer: keeps trailing `-`/`/` so typing flows. */
function liveNormalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^[-/]+/, '')
}

/**
 * Current values of every non-literal token's sibling field. The token list
 * is compiled once at boot and constant for the life of the form, so calling
 * a hook per token keeps a stable hook order across renders.
 */
function useTokenValues(tokens: SlugToken[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const token of tokens) {
    if (token.kind === 'literal') continue
    values[token.name] = useFieldValue(token.name)
  }
  return values
}

export default function SlugField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const { client } = useLatha()
  const tokens = ((field as { tokens?: SlugToken[] }).tokens ?? []) as SlugToken[]
  const values = useTokenValues(tokens)

  // Referenced docs for ref tokens (e.g. {category.slug}), keyed by token
  // field name; re-fetched only when a referenced id changes.
  const refTokens = tokens.filter((t) => t.kind === 'ref')
  const refIds = refTokens.map((t) => {
    const v = values[t.name]
    const first = Array.isArray(v) ? v[0] : v
    return first == null || first === '' ? undefined : String(first)
  })
  const refDocs = useAsync<Record<string, JsonDoc | null>>(async () => {
    const out: Record<string, JsonDoc | null> = {}
    await Promise.all(
      refTokens.map(async (t, i) => {
        const refId = refIds[i]
        out[t.name] = refId ? await client.get(t.via, refId) : null
      }),
    )
    return out
  }, [refIds.join('|')])

  const preview = slugifyPath(
    tokens
      .map((t) => {
        if (t.kind === 'literal') return t.text
        if (t.kind === 'field') return renderTokenValue(values[t.name], t.format)
        return renderTokenValue(refDocs.data?.[t.name]?.[t.path], t.format)
      })
      .join(''),
  )

  // Editing an existing doc starts locked; a fresh form follows the template.
  const [locked, setLocked] = useState(() => typeof value === 'string' && value !== '')

  const current = typeof value === 'string' ? value : ''
  useEffect(() => {
    if (locked || preview === current) return
    onChange(preview === '' ? undefined : preview)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync value to preview only
  }, [locked, preview])

  const label = field.meta?.label ?? humanize(field.name)

  return (
    <FieldWrap
      htmlFor={id}
      label={label}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      {/* The regenerate button lives inside the field border as a trailing
          add-on (InputGroup owns the border + focus ring; the Input drops its
          own), so it reads as one connected control instead of a detached
          button floating beside the input. */}
      <InputGroup>
        <Input
          id={id}
          className="border-0 font-mono shadow-none focus-visible:ring-0"
          placeholder={field.meta?.placeholder}
          value={current}
          onChange={(e) => {
            setLocked(true)
            onChange(liveNormalize(e.target.value))
          }}
          onBlur={() => {
            const clean = slugifyPath(current)
            if (clean !== current) onChange(clean === '' ? undefined : clean)
            onBlur()
          }}
        />
        <InputAddon>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            title="Regenerate from template"
            aria-label="Regenerate slug from template"
            onClick={() => {
              setLocked(false)
              onChange(preview === '' ? undefined : preview)
            }}
          >
            <RegenerateIcon />
          </Button>
        </InputAddon>
      </InputGroup>
    </FieldWrap>
  )
}

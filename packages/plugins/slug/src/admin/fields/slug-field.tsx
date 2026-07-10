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
 *
 * In `nested` mode the input edits only this page's own URL segment; the
 * selected parent's full path renders as a read-only `/parent/path/` prefix
 * inside the control (fetched live as the writer picks a parent), so the
 * whole control reads as the page's URL. The server recomputes the real path
 * (and cascades it to descendants) on save.
 */
import { useEffect, useState } from 'react'
import { Button, Field as FieldWrap, Input, InputAddon, InputGroup } from '@kon10/ui'
import { type FieldControlProps, humanize, useFieldValue } from '@kon10/admin-sdk'
import { useKon10, useAsync, type JsonDoc } from '@kon10/start'
import { slugify, slugifyPath } from '../../slugify.js'
import { renderTokenValue, type SlugToken } from '../../template.js'

export const config = { type: 'slug' }

/** The resolved nested config `slugPlugin` stamps onto the field at onInit. */
interface NestedConfig {
  parent: string
  pathField: string
  to: string
}

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
function liveNormalize(input: string, allowSlash: boolean): string {
  const folded = input
    .toLowerCase()
    .replace(allowSlash ? /[^a-z0-9/-]+/g : /[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
  return (allowSlash ? folded.replace(/\/{2,}/g, '/') : folded).replace(/^[-/]+/, '')
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
  const { client } = useKon10()
  const tokens = ((field as { tokens?: SlugToken[] }).tokens ?? []) as SlugToken[]
  const nested = (field as { nested?: NestedConfig }).nested
  const values = useTokenValues(tokens)
  // Nested slugs are single segments; flat slugs may carry `/` path structure.
  const fold = nested ? slugify : slugifyPath

  // Selected parent id, live from the form. The empty-name fallback keeps the
  // hook call unconditional (it reads an always-absent form key).
  const parentValue = useFieldValue(nested?.parent ?? '')
  const parentId = (() => {
    const first = Array.isArray(parentValue) ? parentValue[0] : parentValue
    return first == null || first === '' ? undefined : String(first)
  })()

  const parentDoc = useAsync<JsonDoc | null>(
    async () => (nested && parentId ? await client.get(nested.to, parentId) : null),
    [parentId],
  )
  // Fall back to the parent's own leaf when its path predates the plugin.
  const parentPathValue = nested
    ? (parentDoc.data?.[nested.pathField] ?? parentDoc.data?.[field.name])
    : undefined
  const parentPath = typeof parentPathValue === 'string' ? parentPathValue : ''

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

  const preview = fold(
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
      {/* The prefix/regenerate add-ons live inside the field border (InputGroup
          owns the border + focus ring; the Input drops its own), so the whole
          thing reads as one connected control — in nested mode, as the page's
          full URL with only the leaf segment editable. */}
      <InputGroup>
        {nested && (
          <InputAddon className="font-mono" aria-hidden="true">
            /{parentPath === '' ? '' : `${parentPath}/`}
          </InputAddon>
        )}
        <Input
          id={id}
          className="border-0 font-mono shadow-none focus-visible:ring-0"
          placeholder={field.meta?.placeholder}
          value={current}
          onChange={(e) => {
            setLocked(true)
            onChange(liveNormalize(e.target.value, !nested))
          }}
          onBlur={() => {
            const clean = fold(current)
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

/**
 * `seo` field renderer — the search-engine surface, led by a live Google
 * result preview.
 *
 * Text inputs are rendered directly (single label + an inline character
 * counter) rather than through `getFieldRenderer`, so a field shows one label
 * instead of two. The preview mirrors what the server derives: while the title
 * or description is blank it falls back to the value the derivation hook would
 * fill from the field's `from` templates (read live from sibling form values),
 * so a writer sees the real search result before saving. The Open Graph /
 * Twitter surface lives in its own `socialGraph` field / tab.
 */
import { useState } from 'react'
import { Badge, Card, CardContent, Input, Separator, Switch, Textarea } from '@kon10/ui'
import { type FieldControlProps, useFieldValue } from '@kon10/studio-sdk'
import type { Field } from 'kon10'
import { DEFAULT_MAX_DESCRIPTION_LENGTH, DEFAULT_MAX_TITLE_LENGTH, type SeoData } from '../../schema.js'
import { applyTitleTemplate, resolveTemplate, templateTokens } from '../../template.js'
import { CharCounter, LabeledField } from '../ui.js'

export const config = { type: 'seo' }

/** The resolved config `seoPlugin` stamps onto the field at onInit. */
type SeoFieldConfig = Field & {
  from?: Record<string, string>
  titleTemplate?: string
  robots?: boolean
  maxTitleLength?: number
  maxDescriptionLength?: number
}

/** Truncate for a preview line the way search engines visually clip. */
function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/**
 * Live sibling values for every field referenced by the `from` templates. The
 * token set is derived from the (constant) `from` map, so the per-token hook
 * calls keep a stable order across renders — the same guarantee the slug
 * renderer relies on.
 */
function useDerived(
  from: Record<string, string> | undefined,
  titleTemplate: string | undefined,
): { title: string; description: string } {
  const tokens = from ? [...new Set(Object.values(from).flatMap(templateTokens))] : []
  const values: Record<string, unknown> = {}
  for (const name of tokens) values[name] = useFieldValue(name)

  const title = from?.title ? applyTitleTemplate(resolveTemplate(from.title, values), titleTemplate) : ''
  const description = from?.description ? resolveTemplate(from.description, values) : ''
  return { title, description }
}

export default function SeoField({ field, id, value, onChange }: FieldControlProps) {
  const cfg = field as SeoFieldConfig
  const showRobots = cfg.robots !== false
  const maxTitle = cfg.maxTitleLength ?? DEFAULT_MAX_TITLE_LENGTH
  const maxDescription = cfg.maxDescriptionLength ?? DEFAULT_MAX_DESCRIPTION_LENGTH

  const seo = (value && typeof value === 'object' ? value : {}) as SeoData
  const derived = useDerived(cfg.from, cfg.titleTemplate)
  const [showRobotsPanel, setShowRobotsPanel] = useState(false)

  function setField(name: keyof SeoData, next: unknown) {
    const merged = { ...seo }
    if (next === '' || next === undefined || next === null || next === false) delete merged[name]
    else (merged as Record<string, unknown>)[name] = next
    onChange(Object.keys(merged).length ? merged : undefined)
  }

  const title = typeof seo.title === 'string' ? seo.title : ''
  const description = typeof seo.description === 'string' ? seo.description : ''
  const canonical = typeof seo.canonical === 'string' ? seo.canonical : ''

  const previewTitle = title || derived.title
  const previewDescription = description || derived.description
  const notIndexed = Boolean(seo.noindex || seo.nofollow)

  return (
    <div className="flex flex-col gap-form">
      {field.meta?.description && (
        <p className="text-caption text-muted-foreground">{field.meta.description}</p>
      )}

      {/* Live Google result preview — the leading element, snippet-width. */}
      <Card className="max-w-xl overflow-hidden">
        <CardContent className="flex flex-col gap-stack py-card">
          <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">
            Search preview
          </span>
          <span className="mt-stack truncate text-caption text-success">
            {canonical || 'https://example.com/…'}
          </span>
          <span className="text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
            {previewTitle ? clip(previewTitle, maxTitle) : <span className="text-muted-foreground">Untitled page</span>}
          </span>
          <span className="line-clamp-2 text-caption leading-relaxed text-muted-foreground">
            {previewDescription || 'No description yet — add one so search engines show your own summary.'}
          </span>
        </CardContent>
      </Card>

      <LabeledField
        htmlFor={`${id}-title`}
        label="Meta Title"
        action={<CharCounter length={title.length} max={maxTitle} />}
      >
        <Input
          id={`${id}-title`}
          value={title}
          placeholder={derived.title || 'Title shown in search results'}
          onChange={(e) => setField('title', e.target.value)}
        />
      </LabeledField>

      <LabeledField
        htmlFor={`${id}-description`}
        label="Meta Description"
        action={<CharCounter length={description.length} max={maxDescription} />}
      >
        <Textarea
          id={`${id}-description`}
          rows={3}
          value={description}
          placeholder={derived.description || 'Short summary for search results'}
          onChange={(e) => setField('description', e.target.value)}
        />
      </LabeledField>

      <LabeledField htmlFor={`${id}-canonical`} label="Canonical URL">
        <Input
          id={`${id}-canonical`}
          type="url"
          value={canonical}
          placeholder="https://example.com/page"
          onChange={(e) => setField('canonical', e.target.value)}
        />
      </LabeledField>

      {showRobots && (
        <>
          <Separator />
          <div className="flex flex-col gap-field">
            <button
              type="button"
              onClick={() => setShowRobotsPanel((v) => !v)}
              aria-expanded={showRobotsPanel}
              className="flex min-h-tap w-full items-center justify-between gap-inline text-caption font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
            >
              <span className="flex items-center gap-inline">
                Search engine visibility
                {notIndexed && (
                  <Badge variant="warning">
                    {[seo.noindex && 'noindex', seo.nofollow && 'nofollow'].filter(Boolean).join(' · ')}
                  </Badge>
                )}
              </span>
              <span>{showRobotsPanel ? 'Hide' : 'Edit'}</span>
            </button>

            {showRobotsPanel && (
              <div className="flex flex-col gap-form rounded-md border border-border/60 p-card">
                <label htmlFor={`${id}-noindex`} className="flex items-center justify-between gap-inline">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">Discourage search engines</span>
                    <span className="text-caption text-muted-foreground">Adds <code>noindex</code> — ask engines not to list this page.</span>
                  </span>
                  <Switch
                    id={`${id}-noindex`}
                    checked={seo.noindex ?? false}
                    onChange={(e) => setField('noindex', (e.target as HTMLInputElement).checked)}
                  />
                </label>
                <label htmlFor={`${id}-nofollow`} className="flex items-center justify-between gap-inline">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">Don't follow links</span>
                    <span className="text-caption text-muted-foreground">Adds <code>nofollow</code> — ask engines not to follow this page's links.</span>
                  </span>
                  <Switch
                    id={`${id}-nofollow`}
                    checked={seo.nofollow ?? false}
                    onChange={(e) => setField('nofollow', (e.target as HTMLInputElement).checked)}
                  />
                </label>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

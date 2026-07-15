/**
 * `seo` field renderer — the search-engine surface, with a live Google preview.
 *
 * Composes the Studio's existing renderers through `getFieldRenderer` (the same
 * pattern `GroupField` uses) for the title/description/canonical inputs, and
 * adds the search-result preview plus soft length counters. The Open Graph /
 * Twitter surface lives in its own `socialGraph` field / tab (see
 * `social-field.tsx`).
 *
 * The preview mirrors what the server derives: while a title/description is
 * blank it falls back to the value the derivation hook would fill from the
 * field's `from` templates (read live from sibling form values), so a writer
 * sees the real search result before saving.
 */
import { useState } from 'react'
import { Badge, Card, CardContent, Separator, Switch, cn } from '@kon10/ui'
import { type FieldControlProps, getFieldRenderer, humanize, useFieldValue } from '@kon10/studio-sdk'
import type { Field, FieldMeta } from '@kon10/core'
import { DEFAULT_MAX_DESCRIPTION_LENGTH, DEFAULT_MAX_TITLE_LENGTH, type SeoData } from '../../schema.js'
import { applyTitleTemplate, resolveTemplate, templateTokens } from '../../template.js'

export const config = { type: 'seo' }

/** The resolved config `seoPlugin` stamps onto the field at onInit. */
type SeoFieldConfig = Field & {
  from?: Record<string, string>
  titleTemplate?: string
  robots?: boolean
  maxTitleLength?: number
  maxDescriptionLength?: number
}

/** A synthesized sub-field config handed to a reused Studio renderer. */
interface ChildFieldConfig {
  name: keyof SeoData
  type: string
  meta?: FieldMeta
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

/** A soft "N / max" character counter that turns amber past the threshold. */
function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn('text-caption tabular-nums', length > max ? 'text-warning' : 'text-muted-foreground')}>
      {length} / {max}
    </span>
  )
}

export default function SeoField({ field, id, value, onChange }: FieldControlProps) {
  const cfg = field as SeoFieldConfig
  const showRobots = cfg.robots !== false
  const maxTitle = cfg.maxTitleLength ?? DEFAULT_MAX_TITLE_LENGTH
  const maxDescription = cfg.maxDescriptionLength ?? DEFAULT_MAX_DESCRIPTION_LENGTH

  const seo = (value && typeof value === 'object' ? value : {}) as SeoData
  const derived = useDerived(cfg.from, cfg.titleTemplate)
  const [showAdvanced, setShowAdvanced] = useState(false)

  function setChild(name: keyof SeoData, next: unknown) {
    const merged = { ...seo }
    if (next === '' || next === undefined || next === null || next === false) delete merged[name]
    else (merged as Record<string, unknown>)[name] = next
    onChange(Object.keys(merged).length ? merged : undefined)
  }

  const renderChild = (child: ChildFieldConfig) => {
    const Renderer = getFieldRenderer(child.type)
    return (
      <Renderer
        key={child.name}
        field={child as unknown as Field}
        id={`${id}-${child.name}`}
        value={(seo as Record<string, unknown>)[child.name]}
        onChange={(v) => setChild(child.name, v)}
        onBlur={() => {}}
        error={undefined}
      />
    )
  }

  const previewTitle = seo.title || derived.title
  const previewDescription = seo.description || derived.description
  const label = field.meta?.label ?? humanize(field.name)

  return (
    <div className="flex flex-col gap-field">
      <div className="flex items-center justify-between gap-inline">
        <h3 className="text-base font-semibold">{label}</h3>
        {(seo.noindex || seo.nofollow) && (
          <Badge variant="warning">
            {[seo.noindex && 'noindex', seo.nofollow && 'nofollow'].filter(Boolean).join(' · ')}
          </Badge>
        )}
      </div>
      {field.meta?.description && (
        <p className="text-caption text-muted-foreground">{field.meta.description}</p>
      )}

      {/* Live Google result preview. */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-1 py-card">
          <p className="text-caption text-muted-foreground">Search preview</p>
          <span className="truncate text-caption text-success">
            {seo.canonical || 'https://example.com/…'}
          </span>
          <span className="text-[1.05rem] leading-tight text-[#1a0dab] dark:text-[#8ab4f8]">
            {previewTitle ? clip(previewTitle, maxTitle) : <span className="text-muted-foreground">Untitled page</span>}
          </span>
          <span className="text-caption text-muted-foreground">
            {previewDescription
              ? clip(previewDescription, maxDescription)
              : 'No description — add one so search engines show your own summary.'}
          </span>
        </CardContent>
      </Card>

      {/* Search-engine fields. */}
      <div className="flex flex-col gap-form">
        <div className="flex items-center justify-between gap-inline">
          <span className="text-caption font-medium text-muted-foreground">Meta title</span>
          <Counter length={(seo.title ?? '').length} max={maxTitle} />
        </div>
        {renderChild({
          name: 'title',
          type: 'text',
          meta: { placeholder: derived.title || 'Page title shown in search results' },
        })}
        <div className="flex items-center justify-between gap-inline">
          <span className="text-caption font-medium text-muted-foreground">Meta description</span>
          <Counter length={(seo.description ?? '').length} max={maxDescription} />
        </div>
        {renderChild({
          name: 'description',
          type: 'text',
          meta: { multiline: true, placeholder: derived.description || 'Short summary for search & social cards' },
        })}
        {renderChild({
          name: 'canonical',
          type: 'text',
          meta: { label: 'Canonical URL', inputType: 'url', placeholder: 'https://example.com/page' },
        })}
      </div>

      {showRobots && (
        <>
          <Separator />
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="flex min-h-tap w-full items-center justify-between text-caption font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
          >
            Search engine visibility
            <span className="text-caption">{showAdvanced ? 'Hide' : 'Show'}</span>
          </button>
          {showAdvanced && (
            <div className="flex flex-col gap-form">
              <label className="flex items-center justify-between gap-inline">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">Discourage search engines (noindex)</span>
                  <span className="text-caption text-muted-foreground">Ask engines not to list this page.</span>
                </span>
                <Switch
                  checked={seo.noindex ?? false}
                  onChange={(e) => setChild('noindex', (e.target as HTMLInputElement).checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-inline">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">Don't follow links (nofollow)</span>
                  <span className="text-caption text-muted-foreground">Ask engines not to follow links from this page.</span>
                </span>
                <Switch
                  checked={seo.nofollow ?? false}
                  onChange={(e) => setChild('nofollow', (e.target as HTMLInputElement).checked)}
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  )
}

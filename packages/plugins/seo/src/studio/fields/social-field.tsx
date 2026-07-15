/**
 * `socialGraph` field renderer — the Open Graph / Twitter surface, with a live
 * social-card preview. Rendered in its own "Social Graph" tab, split out from
 * the search-engine `seo` field.
 *
 * Like the seo renderer, it composes the Studio's existing renderers through
 * `getFieldRenderer` — so the share image reuses the media plugin's picker and
 * the enums reuse the select renderer. The card preview reflects the real
 * fallback chain: OG title → the sibling SEO field's title (read live via
 * `useFieldValue(cfg.seoField)`), same for the description, so a writer sees
 * exactly what a share will look like without re-entering the SEO copy.
 */
import { Card, CardContent, Separator } from '@kon10/ui'
import { type FieldControlProps, getFieldRenderer, humanize, useFieldValue } from '@kon10/studio-sdk'
import { useKon10, useAsync, type JsonDoc } from '@kon10/start'
import type { Field, FieldMeta } from '@kon10/core'
import { OG_TYPES, TWITTER_CARDS, type SeoData, type SocialData } from '../../schema.js'

export const config = { type: 'socialGraph' }

/** The resolved config `seoPlugin` stamps onto the field at onInit. */
type SocialFieldConfig = Field & {
  seoField?: string
  maxTitleLength?: number
}

/** A synthesized sub-field config handed to a reused Studio renderer. */
interface ChildFieldConfig {
  name: keyof SocialData
  type: string
  options?: string[]
  meta?: FieldMeta
}

export default function SocialGraphField({ field, id, value, onChange }: FieldControlProps) {
  const cfg = field as SocialFieldConfig
  const { client } = useKon10()
  const social = (value && typeof value === 'object' ? value : {}) as SocialData

  // Fall back to the sibling SEO field's copy (the empty-name key stays absent,
  // keeping the hook call unconditional when no seo field is linked).
  const seoValue = useFieldValue(cfg.seoField ?? '')
  const seo = (seoValue && typeof seoValue === 'object' ? seoValue : {}) as SeoData

  // Resolve the share image (a media id) to a URL for the preview thumbnail.
  const ogImageId = typeof social.ogImage === 'string' && social.ogImage !== '' ? social.ogImage : undefined
  const ogImageDoc = useAsync<JsonDoc | null>(
    async () => (ogImageId ? await client.get('media', ogImageId) : null),
    [ogImageId],
  )
  const ogImageUrl =
    typeof ogImageDoc.data?.url === 'string'
      ? ogImageDoc.data.url
      : typeof ogImageDoc.data?.path === 'string'
        ? ogImageDoc.data.path
        : undefined

  function setChild(name: keyof SocialData, next: unknown) {
    const merged = { ...social }
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
        value={(social as Record<string, unknown>)[child.name]}
        onChange={(v) => setChild(child.name, v)}
        onBlur={() => {}}
        error={undefined}
      />
    )
  }

  const cardTitle = social.ogTitle || seo.title || 'Untitled page'
  const cardDescription = social.ogDescription || seo.description || 'Add a description so shares read well.'
  const host = (() => {
    try {
      return seo.canonical ? new URL(seo.canonical).host : 'example.com'
    } catch {
      return 'example.com'
    }
  })()
  const label = field.meta?.label ?? humanize(field.name)

  return (
    <div className="flex flex-col gap-field">
      <h3 className="text-base font-semibold">{label}</h3>
      {field.meta?.description && (
        <p className="text-caption text-muted-foreground">{field.meta.description}</p>
      )}

      {/* Live social-card preview (Open Graph large-image layout). */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-0 p-0">
          <p className="px-card pt-card text-caption text-muted-foreground">Social preview</p>
          <div className="m-card overflow-hidden rounded-lg border">
            <div className="flex aspect-[1.91/1] items-center justify-center bg-muted text-caption text-muted-foreground">
              {ogImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Studio-only preview, not a Next route
                <img src={ogImageUrl} alt="" className="size-full object-cover" />
              ) : (
                'No share image'
              )}
            </div>
            <div className="flex flex-col gap-0.5 border-t bg-card px-3 py-2">
              <span className="text-caption uppercase text-muted-foreground">{host}</span>
              <span className="line-clamp-1 text-sm font-semibold">{cardTitle}</span>
              <span className="line-clamp-2 text-caption text-muted-foreground">{cardDescription}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Open Graph fields. */}
      <div className="flex flex-col gap-form">
        {renderChild({ name: 'ogImage', type: 'media', meta: { label: 'Share Image', aspectRatio: '1.91:1' } })}
        {renderChild({ name: 'ogTitle', type: 'text', meta: { label: 'Social Title', placeholder: seo.title || 'Defaults to the meta title' } })}
        {renderChild({ name: 'ogDescription', type: 'text', meta: { label: 'Social Description', multiline: true, placeholder: seo.description || 'Defaults to the meta description' } })}
        {renderChild({ name: 'ogType', type: 'select', options: [...OG_TYPES], meta: { label: 'Open Graph Type', width: 'half' } })}
      </div>

      <Separator />

      {/* Twitter fields. */}
      <div className="flex flex-col gap-form">
        <p className="text-caption font-medium text-muted-foreground">Twitter / X</p>
        {renderChild({ name: 'twitterCard', type: 'select', options: [...TWITTER_CARDS], meta: { label: 'Card Type', width: 'half' } })}
        {renderChild({ name: 'twitterTitle', type: 'text', meta: { label: 'Twitter Title', placeholder: cardTitle } })}
        {renderChild({ name: 'twitterDescription', type: 'text', meta: { label: 'Twitter Description', multiline: true, placeholder: cardDescription } })}
      </div>
    </div>
  )
}

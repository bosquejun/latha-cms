/**
 * `socialGraph` field renderer — the Open Graph / Twitter surface, led by a
 * realistic share-card preview. Rendered in its own "Social Graph" tab, split
 * out from the search-engine `seo` field.
 *
 * The share image (`media`) and the enum pickers reuse the Studio's own
 * renderers through `getFieldRenderer` (so the image reuses the media picker);
 * the text overrides are rendered directly for a single, aligned label. The
 * card preview reflects the real fallback chain — OG title → the sibling SEO
 * field's title (read live via `useFieldValue(cfg.seoField)`), same for the
 * description — so a writer sees exactly what a share will look like without
 * re-entering the SEO copy.
 */
import { Input, Separator, Textarea } from '@kon10/ui'
import { type FieldControlProps, getFieldRenderer, useFieldValue } from '@kon10/studio-sdk'
import { useKon10, useAsync, type JsonDoc } from '@kon10/start'
import type { Field, FieldMeta } from '@kon10/core'
import { OG_TYPES, TWITTER_CARDS, type SeoData, type SocialData } from '../../schema.js'
import { LabeledField } from '../ui.js'

export const config = { type: 'socialGraph' }

/** The resolved config `seoPlugin` stamps onto the field at onInit. */
type SocialFieldConfig = Field & { seoField?: string }

/** A synthesized sub-field config handed to a reused Studio renderer. */
interface ChildFieldConfig {
  name: keyof SocialData
  type: string
  options?: string[]
  meta?: FieldMeta
}

/** A small SVG placeholder shown before a share image is chosen. */
function ImagePlaceholder() {
  return (
    <div className="flex aspect-[1.91/1] w-full flex-col items-center justify-center gap-stack bg-muted text-muted-foreground">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
      <span className="text-caption">No share image</span>
    </div>
  )
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

  function setField(name: keyof SocialData, next: unknown) {
    const merged = { ...social }
    if (next === '' || next === undefined || next === null || next === false) delete merged[name]
    else (merged as Record<string, unknown>)[name] = next
    onChange(Object.keys(merged).length ? merged : undefined)
  }

  const renderChild = (child: ChildFieldConfig) => {
    const Renderer = getFieldRenderer(child.type)
    return (
      <Renderer
        field={child as unknown as Field}
        id={`${id}-${child.name}`}
        value={(social as Record<string, unknown>)[child.name]}
        onChange={(v) => setField(child.name, v)}
        onBlur={() => {}}
        error={undefined}
      />
    )
  }

  const ogTitle = typeof social.ogTitle === 'string' ? social.ogTitle : ''
  const ogDescription = typeof social.ogDescription === 'string' ? social.ogDescription : ''
  const twitterTitle = typeof social.twitterTitle === 'string' ? social.twitterTitle : ''
  const twitterDescription = typeof social.twitterDescription === 'string' ? social.twitterDescription : ''

  const cardTitle = ogTitle || seo.title || 'Untitled page'
  const cardDescription = ogDescription || seo.description || 'Add a description so shares read well.'
  const host = (() => {
    try {
      return seo.canonical ? new URL(seo.canonical).host : 'example.com'
    } catch {
      return 'example.com'
    }
  })()

  return (
    <div className="flex flex-col gap-form">
      {field.meta?.description && (
        <p className="text-caption text-muted-foreground">{field.meta.description}</p>
      )}

      {/* Live social-card preview (Open Graph large-image layout), share-width. */}
      <div className="flex flex-col gap-field">
        <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">
          Social preview
        </span>
        <div className="max-w-sm overflow-hidden rounded-xl border bg-card shadow-sm">
          {ogImageUrl ? (
            <img src={ogImageUrl} alt="" className="aspect-[1.91/1] w-full object-cover" />
          ) : (
            <ImagePlaceholder />
          )}
          <div className="flex flex-col gap-0.5 border-t px-group py-2.5">
            <span className="truncate text-caption uppercase text-muted-foreground">{host}</span>
            <span className="line-clamp-1 text-sm font-semibold text-foreground">{cardTitle}</span>
            <span className="line-clamp-2 text-caption text-muted-foreground">{cardDescription}</span>
          </div>
        </div>
      </div>

      {/* Open Graph. */}
      <div className="flex flex-col gap-form">
        {renderChild({ name: 'ogImage', type: 'media', meta: { label: 'Share Image', aspectRatio: '1.91:1' } })}
        <LabeledField htmlFor={`${id}-ogTitle`} label="Social Title">
          <Input
            id={`${id}-ogTitle`}
            value={ogTitle}
            placeholder={seo.title || 'Defaults to the meta title'}
            onChange={(e) => setField('ogTitle', e.target.value)}
          />
        </LabeledField>
        <LabeledField htmlFor={`${id}-ogDescription`} label="Social Description">
          <Textarea
            id={`${id}-ogDescription`}
            rows={2}
            value={ogDescription}
            placeholder={seo.description || 'Defaults to the meta description'}
            onChange={(e) => setField('ogDescription', e.target.value)}
          />
        </LabeledField>
        {renderChild({ name: 'ogType', type: 'select', options: [...OG_TYPES], meta: { label: 'Open Graph Type' } })}
      </div>

      <Separator />

      {/* Twitter / X. */}
      <div className="flex flex-col gap-form">
        <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">Twitter / X</span>
        {renderChild({ name: 'twitterCard', type: 'select', options: [...TWITTER_CARDS], meta: { label: 'Card Type' } })}
        <LabeledField htmlFor={`${id}-twitterTitle`} label="Twitter Title">
          <Input
            id={`${id}-twitterTitle`}
            value={twitterTitle}
            placeholder={cardTitle}
            onChange={(e) => setField('twitterTitle', e.target.value)}
          />
        </LabeledField>
        <LabeledField htmlFor={`${id}-twitterDescription`} label="Twitter Description">
          <Textarea
            id={`${id}-twitterDescription`}
            rows={2}
            value={twitterDescription}
            placeholder={cardDescription}
            onChange={(e) => setField('twitterDescription', e.target.value)}
          />
        </LabeledField>
      </div>
    </div>
  )
}

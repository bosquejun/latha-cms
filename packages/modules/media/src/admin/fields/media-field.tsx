/**
 * `media` field renderer — upload input + thumbnail/filename preview. Lives
 * in `@latha/media/admin` (not `@latha/admin-sdk`) so the SDK stays ignorant
 * of what "media" means; registered by `type`, same mechanism as any module
 * field renderer.
 */
import { useState } from 'react'
import { Button, Field as FieldWrap, Spinner } from '@latha/ui'
import { type FieldControlProps, humanize } from '@latha/admin-sdk'
import { useLatha, useAsync, type JsonDoc } from '@latha/start'

export const config = { type: 'media' }

export default function MediaField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const { client } = useLatha()
  const [busy, setBusy] = useState(false)
  const mediaId = typeof value === 'string' ? value : undefined

  const doc = useAsync<JsonDoc | null>(
    () => (mediaId ? client.get('media', mediaId) : Promise.resolve(null)),
    [mediaId],
  )

  const label = field.meta?.label ?? humanize(field.name)

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setBusy(true)
    try {
      const created = await client.upload(file)
      onChange(created.id)
    } finally {
      setBusy(false)
      onBlur()
    }
  }

  return (
    <FieldWrap
      htmlFor={id}
      label={label}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      {doc.loading && mediaId ? (
        <Spinner className="size-4" />
      ) : doc.data?.url ? (
        <div className="flex items-center gap-3">
          {typeof doc.data.mimeType === 'string' && doc.data.mimeType.startsWith('image/') ? (
            <img
              src={String(doc.data.url)}
              alt={String(doc.data.alt ?? '')}
              className="h-16 w-16 rounded-md object-cover"
            />
          ) : (
            <span className="text-small">{String(doc.data.filename)}</span>
          )}
          <Button type="button" variant="ghost" onClick={() => onChange(undefined)}>
            Remove
          </Button>
        </div>
      ) : (
        <input
          id={id}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files)}
          onBlur={onBlur}
        />
      )}
    </FieldWrap>
  )
}

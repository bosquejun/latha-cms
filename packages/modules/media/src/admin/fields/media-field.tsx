/**
 * `media` field renderer — a dropzone with upload progress and a rich preview.
 * Lives in `@kon10/media/admin` (not `@kon10/admin-sdk`) so the SDK stays
 * ignorant of what "media" means; registered by `type`, same mechanism as any
 * module field renderer.
 *
 * Empty: a click-or-drag dropzone. Uploading: the dropzone shows a spinner.
 * Set: a bordered preview card with the image thumbnail (or a file glyph +
 * filename/type/size for non-images) and Replace / Remove actions. A single
 * hidden <input type="file"> is shared by the empty and set states so both the
 * dropzone and the Replace button open the picker.
 */
import { useRef, useState } from 'react'
import { Button, cn, Field as FieldWrap, Spinner } from '@kon10/ui'
import {
  type FieldControlProps,
  humanize,
  useKon10,
  useAsync,
  type JsonDoc,
} from '@kon10/admin-sdk'

export const config = { type: 'media' }

/** Cloud-upload glyph for the empty dropzone. Inlined to avoid an icon dep. */
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20 16.7A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
    </svg>
  )
}

/** Bytes → a compact human label (e.g. `1.4 MB`). */
function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const n = bytes / 1024 ** i
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`
}

export default function MediaField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const { client } = useKon10()
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // `client.upload()` returns the full media doc, so we keep it to render the
  // preview immediately without a second round-trip. `get('media', id)` only
  // runs when a value arrives without a matching cached doc (e.g. edit view).
  const [uploaded, setUploaded] = useState<JsonDoc | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mediaId = typeof value === 'string' ? value : undefined

  const doc = useAsync<JsonDoc | null>(() => {
    if (!mediaId) return Promise.resolve(null)
    if (uploaded && uploaded.id === mediaId) return Promise.resolve(uploaded)
    return client.get('media', mediaId)
  }, [mediaId, uploaded])

  const label = field.meta?.label ?? humanize(field.name)

  async function upload(file: File) {
    setBusy(true)
    try {
      const created = await client.upload(file)
      setUploaded(created)
      onChange(created.id)
    } finally {
      setBusy(false)
      onBlur()
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) void upload(file)
  }

  const openPicker = () => inputRef.current?.click()

  const meta = doc.data
  const url = typeof meta?.url === 'string' ? meta.url : undefined
  const mimeType = typeof meta?.mimeType === 'string' ? meta.mimeType : undefined
  const filename = typeof meta?.filename === 'string' ? meta.filename : undefined
  const size = typeof meta?.size === 'number' ? meta.size : undefined
  const isImage = mimeType?.startsWith('image/') ?? false
  const subtitle = [mimeType, size != null ? formatSize(size) : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <FieldWrap
      htmlFor={id}
      label={label}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      {/* One shared, visually-hidden input drives both the dropzone and Replace. */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => handleFiles(e.target.files)}
        onBlur={onBlur}
      />

      {doc.loading && mediaId ? (
        <div className="flex items-center gap-2 rounded-md border border-input px-3 py-3 text-caption text-muted-foreground">
          <Spinner className="size-4" /> Loading…
        </div>
      ) : url ? (
        <div className="flex flex-col gap-2 rounded-md border border-input bg-background p-2">
          {isImage ? (
            <img
              src={url}
              alt={typeof meta?.alt === 'string' ? meta.alt : (filename ?? '')}
              className="aspect-video w-full rounded-md border border-border bg-muted object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <FileIcon className="size-8" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 px-1">
              <p className="truncate text-small font-medium" title={filename}>
                {filename ?? 'Uploaded file'}
              </p>
              {subtitle && <p className="text-caption text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-inline">
              <Button type="button" variant="ghost" size="sm" loading={busy} onClick={openPicker}>
                Replace
              </Button>
              <Button
                type="button"
                variant="destructive-subtle"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setUploaded(null)
                  onChange(undefined)
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault()
            if (!busy) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (!busy) handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-input px-4 py-6 text-center transition-colors',
            'hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none',
            'disabled:cursor-not-allowed disabled:opacity-70',
            dragOver && 'border-ring bg-accent/60',
          )}
        >
          {busy ? (
            <span className="flex items-center gap-2 text-small text-muted-foreground">
              <Spinner className="size-4" /> Uploading…
            </span>
          ) : (
            <>
              <UploadIcon className="size-6 text-muted-foreground" />
              <span className="text-small font-medium">
                Click to upload
                <span className="font-normal text-muted-foreground"> or drag &amp; drop</span>
              </span>
              <span className="text-caption text-muted-foreground">Images only</span>
            </>
          )}
        </button>
      )}
    </FieldWrap>
  )
}

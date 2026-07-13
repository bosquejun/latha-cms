/**
 * Media Library list view — a thumbnail grid instead of the generic table.
 * Registered for the `media` entity slug via `defineEntityListConfig`, so
 * `@kon10/studio-sdk`'s `EntityList` (and `@kon10/start`'s `ListView`) never
 * need to know media exists — the same extension-first pattern as the
 * `media` field renderer.
 */
import { useRef, useState } from 'react'
import { Button, ConfirmDialog, toast } from '@kon10/ui'
import {
  EmptyState,
  defineEntityListConfig,
  useKon10,
  type EntityListProps,
} from '@kon10/studio-sdk'

export const config = defineEntityListConfig({ slug: 'media', managesCreate: true })

/** Trash glyph for the per-thumbnail delete action. Inlined to avoid an icon dep. */
function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export default function MediaLibraryList({
  rows,
  getEditHref,
  onDelete,
  canCreate,
  onRefresh,
  busy,
}: EntityListProps) {
  const { client } = useKon10()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingRow = rows.find((r) => r.id === pendingDeleteId)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) await client.upload(file)
      toast.success(`${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded.`)
      onRefresh?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const uploadControl = canCreate ? (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void upload(event.target.files)}
      />
      <Button type="button" loading={uploading} onClick={() => inputRef.current?.click()}>
        Upload files
      </Button>
    </>
  ) : undefined

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No media yet"
        description="Upload your first file to start building the library."
        action={uploadControl}
      />
    )
  }

  return (
    <>
      {uploadControl && (
        <div className="flex justify-end border-b border-border px-card pb-card">
          {uploadControl}
        </div>
      )}
      <div className="grid grid-cols-2 gap-card-gap p-card sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {rows.map((row) => {
          const url = typeof row.url === 'string' ? row.url : undefined
          const mimeType = typeof row.mimeType === 'string' ? row.mimeType : undefined
          const filename = typeof row.filename === 'string' ? row.filename : row.id
          const isImage = mimeType?.startsWith('image/') ?? false

          return (
            <div key={row.id} className="group relative flex flex-col gap-tight">
              <a
                href={getEditHref(row.id)}
                className="block aspect-square overflow-hidden rounded-md border bg-muted"
              >
                {isImage && url ? (
                  <img
                    src={url}
                    alt={typeof row.alt === 'string' ? row.alt : filename}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-inline text-center text-caption text-muted-foreground">
                    {filename}
                  </div>
                )}
              </a>
              <a
                href={getEditHref(row.id)}
                className="truncate text-caption text-foreground hover:underline"
                title={filename}
              >
                <h2 className="truncate text-caption font-medium">{filename}</h2>
              </a>
              {onDelete && (
                // Hover-revealed on fine pointers; always visible on touch
                // devices (there is no hover to reveal it) and when focused
                // via keyboard. The translucent backdrop keeps it legible
                // over any thumbnail.
                <Button
                  type="button"
                  size="icon-sm"
                  variant="destructive-subtle"
                  disabled={busy}
                  aria-label={`Delete ${filename}`}
                  title="Delete"
                  className="absolute right-stack top-stack bg-background/80 opacity-0 shadow-xs backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100 pointer-coarse:opacity-100"
                  onClick={(e) => {
                    e.preventDefault()
                    setPendingDeleteId(row.id)
                  }}
                >
                  <TrashIcon className="size-4" />
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
        title={`Delete "${pendingRow ? String(pendingRow.filename ?? pendingRow.id) : ''}"?`}
        description="This action cannot be undone."
        destructive
        busy={busy}
        onConfirm={() => {
          if (pendingDeleteId) {
            onDelete?.(pendingDeleteId)
            setPendingDeleteId(null)
          }
        }}
      />
    </>
  )
}

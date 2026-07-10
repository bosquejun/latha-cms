/**
 * Media Library list view — a thumbnail grid instead of the generic table.
 * Registered for the `media` entity slug via `defineEntityListConfig`, so
 * `@kon10/studio-sdk`'s `EntityList` (and `@kon10/start`'s `ListView`) never
 * need to know media exists — the same extension-first pattern as the
 * `media` field renderer.
 */
import { useState } from 'react'
import { Button, ConfirmDialog } from '@kon10/ui'
import {
  EmptyState,
  defineEntityListConfig,
  type EntityListProps,
} from '@kon10/studio-sdk'

export const config = defineEntityListConfig({ slug: 'media' })

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

export default function MediaLibraryList({ rows, getEditHref, onDelete, busy }: EntityListProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const pendingRow = rows.find((r) => r.id === pendingDeleteId)

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No media yet"
        description="Upload your first file to start building the library."
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 p-card sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {rows.map((row) => {
          const url = typeof row.url === 'string' ? row.url : undefined
          const mimeType = typeof row.mimeType === 'string' ? row.mimeType : undefined
          const filename = typeof row.filename === 'string' ? row.filename : row.id
          const isImage = mimeType?.startsWith('image/') ?? false

          return (
            <div key={row.id} className="group relative flex flex-col gap-1.5">
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
                  <div className="flex h-full w-full items-center justify-center p-2 text-center text-caption text-muted-foreground">
                    {filename}
                  </div>
                )}
              </a>
              <a
                href={getEditHref(row.id)}
                className="truncate text-caption text-foreground hover:underline"
                title={filename}
              >
                {filename}
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
                  className="absolute right-1 top-1 bg-background/80 opacity-0 shadow-xs backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
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

/**
 * Media Library list view — a thumbnail grid instead of the generic table.
 * Registered for the `media` entity slug via `defineEntityListConfig`, so
 * `@latha/admin-sdk`'s `EntityList` (and `@latha/start`'s `ListView`) never
 * need to know media exists — the same extension-first pattern as the
 * `media` field renderer.
 */
import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@latha/ui'
import { defineEntityListConfig, type EntityListProps } from '@latha/admin-sdk'

export const config = defineEntityListConfig({ slug: 'media' })

export default function MediaLibraryList({ rows, getEditHref, onDelete, busy }: EntityListProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const pendingRow = rows.find((r) => r.id === pendingDeleteId)

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-card text-center text-small text-muted-foreground">
        No media yet.
      </p>
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
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  className="absolute right-1 top-1 bg-background/80 opacity-0 shadow-xs backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                  onClick={(e) => {
                    e.preventDefault()
                    setPendingDeleteId(row.id)
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete "{pendingRow ? String(pendingRow.filename ?? pendingRow.id) : ''}"?
            </DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (pendingDeleteId) {
                  onDelete?.(pendingDeleteId)
                  setPendingDeleteId(null)
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

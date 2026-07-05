/**
 * EntityList — the auto-generated table view for a many-cardinality entity.
 *
 * Columns derive from `defaultColumns` (falling back to the title field plus
 * the first couple of fields). Routing stays in the app: the caller supplies
 * `getEditHref` and `onDelete`, so this view has no dependency on any router.
 */

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@latha/ui'
import { useState, type ReactNode } from 'react'
import { humanize } from '../schema.js'
import type { AdminEntity } from '../schema.js'

export interface EntityRow {
  id: string
  [key: string]: unknown
}

export interface EntityListProps {
  entity: AdminEntity
  rows: EntityRow[]
  getEditHref: (id: string) => string
  onDelete?: (id: string) => void
  busy?: boolean
}

function resolveColumns(entity: AdminEntity): string[] {
  if (entity.defaultColumns?.length) return entity.defaultColumns
  const title = entity.useAsTitle ?? entity.fields[0]?.name
  const names = entity.fields.map((f) => f.name)
  const head = title ? [title] : []
  for (const n of names) {
    if (head.length >= 3) break
    if (!head.includes(n)) head.push(n)
  }
  return head
}

function renderCell(value: unknown, fieldType?: string): ReactNode {
  if (value == null || value === '')
    return <span className="text-muted-foreground">—</span>
  if (typeof value === 'boolean')
    return (
      <Badge variant={value ? 'default' : 'secondary'}>{String(value)}</Badge>
    )
  // Select / status values render as a color-coded status pill.
  if (fieldType === 'select' && typeof value === 'string')
    return <StatusBadge status={value} />
  // Dates are stored as ISO strings — show a locale date, not the raw timestamp.
  if (fieldType === 'date' && (typeof value === 'string' || value instanceof Date)) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString()
  }
  if (typeof value === 'object')
    return (
      <code className="font-mono text-xs">{JSON.stringify(value)}</code>
    )
  return String(value)
}

export function EntityList({
  entity,
  rows,
  getEditHref,
  onDelete,
  busy,
}: EntityListProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const columns = resolveColumns(entity)
  const titleCol = entity.useAsTitle ?? columns[0]
  const colType = new Map(entity.fields.map((f) => [f.name, f.type]))

  const pendingRow = rows.find((r) => r.id === pendingDeleteId)
  const pendingLabel = pendingRow
    ? String(pendingRow[titleCol ?? 'id'] ?? pendingRow.id)
    : ''

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-card text-center text-small text-muted-foreground">
        No {entity.label.toLowerCase()} yet.
      </p>
    )
  }

  return (
    <>
      <Table>
        <THead>
          <TR>
            {columns.map((col) => (
              <TH key={col}>{humanize(col)}</TH>
            ))}
            <TH className="w-0 text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id}>
              {columns.map((col) => (
                <TD key={col}>
                  {col === titleCol ? (
                    <a
                      href={getEditHref(row.id)}
                      className="font-medium text-foreground hover:underline"
                    >
                      {renderCell(row[col], colType.get(col))}
                    </a>
                  ) : (
                    renderCell(row[col], colType.get(col))
                  )}
                </TD>
              ))}
              <TD className="text-right">
                {onDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setPendingDeleteId(row.id)}
                  >
                    Delete
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{pendingLabel}"?</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
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

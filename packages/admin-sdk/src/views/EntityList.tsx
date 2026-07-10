/**
 * EntityList — the auto-generated table view for a many-cardinality entity.
 *
 * Columns derive from `defaultColumns` (falling back to the title field plus
 * the first couple of fields). Routing stays in the app: the caller supplies
 * `getEditHref` and `onDelete`, so this view has no dependency on any router.
 *
 * Row actions follow the design-system convention: icon buttons only — a
 * ghost pencil linking to the edit view and a `destructive-subtle` trash that
 * opens the shared ConfirmDialog. `onDelete` fires only after confirmation,
 * so callers must not stack their own confirm on top.
 */

import {
  Badge,
  Button,
  ConfirmDialog,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@kon10/ui'
import { Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { humanize } from '../schema.js'
import type { AdminEntity } from '../schema.js'
import { EmptyState } from '../shell/EmptyState.js'

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
  if (fieldType === 'select' && typeof value === 'string')
    return <StatusBadge status={value} />
  // Dates are stored as ISO strings — show a locale date, not the raw timestamp.
  if (fieldType === 'date' && (typeof value === 'string' || value instanceof Date)) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString()
  }
  // Arrays (relationship ids, multi-selects) summarize as a count — raw ids
  // are meaningless in a table and JSON blobs don't fit a cell.
  if (Array.isArray(value))
    return (
      <Badge variant="secondary">
        {value.length} {value.length === 1 ? 'item' : 'items'}
      </Badge>
    )
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

  const rowLabel = (row: EntityRow) =>
    String(row[titleCol ?? 'id'] ?? row.id)

  const rowActions = (row: EntityRow) => (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <Button
        asChild
        size="icon-sm"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground"
      >
        <a
          href={getEditHref(row.id)}
          aria-label={`Edit ${rowLabel(row)}`}
          title="Edit"
        >
          <Pencil />
        </a>
      </Button>
      {onDelete && (
        <Button
          size="icon-sm"
          variant="destructive-subtle"
          disabled={busy}
          aria-label={`Delete ${rowLabel(row)}`}
          title="Delete"
          onClick={() => setPendingDeleteId(row.id)}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  )

  if (rows.length === 0) {
    return (
      <EmptyState
        title={`No ${entity.label.toLowerCase()} yet`}
        description={`Create your first to start managing ${entity.label.toLowerCase()}.`}
      />
    )
  }

  return (
    <>
      {/* ── Mobile (< md): stacked cards ──────────────────────────────────
          Tables force horizontal panning on phones, so each row becomes a
          card: tappable title on top, remaining columns as label/value
          pairs, the action icons in the corner. */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => {
          const detailCols = columns.filter((col) => col !== titleCol)
          return (
            <li key={row.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={getEditHref(row.id)}
                  className="min-w-0 flex-1 py-1 font-medium text-foreground"
                >
                  {renderCell(row[titleCol ?? 'id'] ?? row.id, colType.get(titleCol ?? ''))}
                </a>
                {onDelete && (
                  <Button
                    size="icon-sm"
                    variant="destructive-subtle"
                    disabled={busy}
                    aria-label={`Delete ${rowLabel(row)}`}
                    title="Delete"
                    onClick={() => setPendingDeleteId(row.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              {detailCols.length > 0 && (
                <dl className="flex flex-col gap-1">
                  {detailCols.map((col) => (
                    <div key={col} className="flex items-baseline gap-2 text-small">
                      <dt className="shrink-0 text-muted-foreground">{humanize(col)}</dt>
                      <dd className="min-w-0 truncate">
                        {renderCell(row[col], colType.get(col))}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          )
        })}
      </ul>

      {/* ── Tablet & desktop (md+): the classic table ───────────────────── */}
      <div className="max-md:hidden">
      <Table>
        <THead>
          <TR>
            {columns.map((col) => (
              <TH key={col}>{humanize(col)}</TH>
            ))}
            <TH className="w-0 text-right">
              <span className="sr-only">Actions</span>
            </TH>
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
              <TD className="text-right">{rowActions(row)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
        title={`Delete "${pendingLabel}"?`}
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

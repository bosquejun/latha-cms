/**
 * CollectionList — the auto-generated table view for a collection.
 *
 * Columns derive from `defaultColumns` (falling back to the title field plus
 * the first couple of fields). Routing stays in the app: the caller supplies
 * `getEditHref` and `onDelete`, so this view has no dependency on any router.
 */

import {
  Badge,
  Button,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@latha/ui'
import type { ReactNode } from 'react'
import { humanize } from '../schema.js'
import type { AdminEntity } from '../schema.js'

export interface CollectionRow {
  id: string
  [key: string]: unknown
}

export interface CollectionListProps {
  entity: AdminEntity
  rows: CollectionRow[]
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

function renderCell(value: unknown, isSelect: boolean): ReactNode {
  if (value == null || value === '')
    return <span className="text-muted-foreground">—</span>
  if (typeof value === 'boolean')
    return (
      <Badge variant={value ? 'default' : 'secondary'}>{String(value)}</Badge>
    )
  // Select / status values render as a color-coded status pill.
  if (isSelect && typeof value === 'string')
    return <StatusBadge status={value} />
  if (typeof value === 'object')
    return (
      <code className="font-mono text-xs">{JSON.stringify(value)}</code>
    )
  return String(value)
}

export function CollectionList({
  entity,
  rows,
  getEditHref,
  onDelete,
  busy,
}: CollectionListProps) {
  const columns = resolveColumns(entity)
  const titleCol = entity.useAsTitle ?? columns[0]
  const selectCols = new Set(
    entity.fields.filter((f) => f.type === 'select').map((f) => f.name),
  )

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No {entity.label.toLowerCase()} yet.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
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
                    {renderCell(row[col], selectCols.has(col))}
                  </a>
                ) : (
                  renderCell(row[col], selectCols.has(col))
                )}
              </TD>
            ))}
            <TD className="text-right">
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onDelete(row.id)}
                >
                  Delete
                </Button>
              )}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
    </div>
  )
}

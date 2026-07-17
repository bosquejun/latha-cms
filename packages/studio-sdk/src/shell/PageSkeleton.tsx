/**
 * Page-level skeletons — layout-shaped loading placeholders that mirror the
 * real views (list table, entity form, dashboard grid) instead of a bare
 * centered spinner. Rendered while a view waits on its initial data so the
 * page keeps its shape and doesn't reflow when the content lands.
 *
 * These are CMS-aware compositions of the pure `Skeleton` primitive from
 * `@kon10/ui`: `LoadingState` (spinner) stays the generic fallback and the
 * app-boot indicator; a view with a known layout renders one of these.
 */
import { Card, Skeleton } from '@kon10/ui'
import { PageLayout } from './PageLayout.js'

/** Cycled cell widths so table rows read as varied content, not a solid block. */
const CELL_WIDTHS = ['w-40', 'w-24', 'w-32', 'w-20', 'w-28'] as const
const cellWidth = (i: number) => CELL_WIDTHS[i % CELL_WIDTHS.length]

/**
 * Header block matching `PageHeader`'s spacing: a title bar and, optionally, a
 * trailing action button and a description line.
 */
export function PageHeaderSkeleton({
  action = false,
  description = false,
}: {
  action?: boolean
  description?: boolean
}) {
  return (
    <div className="mb-page-gap flex flex-col gap-group">
      <div className="flex flex-wrap items-start justify-between gap-group">
        <div className="flex flex-col gap-stack">
          <Skeleton className="h-7 w-40" />
          {description && <Skeleton className="mt-stack h-4 w-64" />}
        </div>
        {action && <Skeleton className="h-8 w-28" />}
      </div>
    </div>
  )
}

/**
 * List view placeholder: a header (with a New action) above a card holding a
 * table-shaped grid of shimmering rows. `rows`/`columns` default to a typical
 * first page so the skeleton reads as a populated table.
 */
export function ListSkeleton({
  rows = 8,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <PageHeaderSkeleton action />
      <Card className="overflow-hidden p-0">
        {/* Header row */}
        <div className="flex items-center gap-group border-b border-border px-card py-group">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1">
              <Skeleton className={`h-3.5 ${cellWidth(i)}`} />
            </div>
          ))}
          <Skeleton className="h-3.5 w-8 shrink-0" />
        </div>
        {/* Body rows */}
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-group px-card py-form">
              {Array.from({ length: columns }).map((_, c) => (
                <div key={c} className="flex-1">
                  <Skeleton className={`h-4 ${cellWidth(r + c)}`} />
                </div>
              ))}
              <Skeleton className="size-7 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/** A single label + control pair, matching the `Field` wrapper's spacing. */
function FieldSkeleton({ wide = true }: { wide?: boolean }) {
  return (
    <div className="flex flex-col gap-field">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className={wide ? 'h-9 w-full' : 'h-9 w-1/2'} />
    </div>
  )
}

/**
 * Entity form placeholder (create / edit / global): a header, the sticky
 * toolbar's Save action, a column of field rows, and — when `sidebar` — the
 * right metadata panel. `fields` defaults to a short form's worth of rows.
 */
export function FormSkeleton({
  fields = 5,
  sidebar = false,
}: {
  fields?: number
  sidebar?: boolean
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <PageHeaderSkeleton />
      {/* Toolbar: Save sits on the right, mirroring EntityForm's sticky bar. */}
      <div className="mb-page-gap flex items-center justify-end border-b border-border py-2.5">
        <Skeleton className="h-8 w-24" />
      </div>
      <PageLayout
        right={
          sidebar ? (
            <div className="flex flex-col gap-form">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-form">
          {Array.from({ length: fields }).map((_, i) => (
            <FieldSkeleton key={i} />
          ))}
        </div>
      </PageLayout>
    </div>
  )
}

/**
 * Dashboard placeholder: the stat-card grid used by the dashboard's entity
 * tiles, so the whole grid holds its shape while counts resolve.
 */
export function DashboardSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <PageHeaderSkeleton description />
      <div className="grid grid-cols-2 gap-card-gap lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i} className="gap-0 p-0">
            <div className="flex items-center justify-between px-card pt-card">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="size-4 rounded" />
            </div>
            <div className="px-card pb-card pt-tight">
              <Skeleton className="h-8 w-12" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

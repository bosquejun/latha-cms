import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '../lib/utils.js'
import { Button } from './ui/button.js'

export interface PaginationProps {
  /** Total number of rows across all pages. */
  total: number
  /** Zero-based offset of the first visible row. */
  offset: number
  /** Rows per page. */
  pageSize: number
  onOffsetChange: (offset: number) => void
  /** Disable the controls while a page is loading. */
  busy?: boolean
  className?: string
}

/**
 * Pagination — the standard list-footer pager.
 *
 * Range summary on the left ("1–25 of 132"), icon prev/next controls with a
 * "Page X of Y" indicator on the right. Offset-based to match the `page` RPC
 * envelope. Renders nothing when everything fits on one page, so callers can
 * mount it unconditionally below a list.
 */
export function Pagination({
  total,
  offset,
  pageSize,
  onOffsetChange,
  busy = false,
  className,
}: PaginationProps) {
  if (total <= pageSize) return null

  const pageCount = Math.ceil(total / pageSize)
  const page = Math.floor(offset / pageSize) + 1
  const from = offset + 1
  const to = Math.min(offset + pageSize, total)

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex items-center justify-between gap-group text-small text-muted-foreground',
        className,
      )}
    >
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-inline">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Previous page"
          title="Previous page"
          disabled={busy || offset === 0}
          onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
        >
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Next page"
          title="Next page"
          disabled={busy || offset + pageSize >= total}
          onClick={() => onOffsetChange(offset + pageSize)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: React.ReactNode
}

export interface TabsProps extends Omit<React.ComponentProps<'div'>, 'onChange'> {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/**
 * Tabs — a segmented pill control. Controlled (`value` + `onValueChange`) or
 * uncontrolled (`defaultValue`). Renders the pill list only; you render panels.
 */
function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  className,
  ...props
}: TabsProps) {
  const [internal, setInternal] = React.useState(
    defaultValue ?? items[0]?.value,
  )
  const active = value ?? internal

  function select(v: string) {
    if (value === undefined) setInternal(v)
    onValueChange?.(v)
  }

  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-muted p-1',
        className,
      )}
      {...props}
    >
      {items.map((it) => {
        const isActive = active === it.value
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-state={isActive ? 'active' : 'inactive'}
            onClick={() => select(it.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              isActive
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

export { Tabs }

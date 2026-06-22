/** PageHeader — in-content page title, description, and actions slot. */
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-[22px] flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.015em]">{title}</h1>
          {description && (
            <p className="mt-1 text-body text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  )
}

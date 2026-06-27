/** PageHeader — in-content page title, description, and actions slot. */
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-page-gap flex flex-col gap-group">
      <div className="flex flex-wrap items-start justify-between gap-group">
        <div>
          <h1 className="text-h1 font-semibold">{title}</h1>
          {description && (
            <p className="mt-stack text-body text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-inline">{actions}</div>}
      </div>
    </div>
  )
}

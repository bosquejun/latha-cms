/** EmptyState — dashed-card empty state for zero-row lists / unbacked screens. */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-group rounded-xl border border-dashed border-border p-empty text-center">
      <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        <Icon />
      </div>
      <div>
        <h3 className="text-small font-semibold">{title}</h3>
        {description && (
          <p className="mx-auto mt-stack max-w-[360px] text-caption text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

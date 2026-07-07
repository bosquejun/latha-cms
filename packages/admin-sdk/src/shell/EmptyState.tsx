/**
 * EmptyState — dashed-card empty state for zero-row lists / unbacked screens.
 *
 * Accepts both plain lucide-react icons and animated lucide-animated icons.
 * Attaching a ref puts lucide-animated icons in controlled mode, so the
 * animation is driven here: it plays once on mount and re-plays when the
 * pointer enters the card. Static icons expose no handle and simply render.
 */
import { useEffect, useRef, type ComponentType, type ReactNode, type Ref } from 'react'
import { FileStackIcon } from 'lucide-animated'

interface AnimatedIconHandle {
  startAnimation?: () => void
  stopAnimation?: () => void
}

/** Static (lucide-react) or animated (lucide-animated) icon component. */
export type EmptyStateIcon = ComponentType<{ className?: string }>

export interface EmptyStateProps {
  /** Defaults to an animated document-stack icon. */
  icon?: EmptyStateIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon = FileStackIcon, title, description, action }: EmptyStateProps) {
  const iconRef = useRef<AnimatedIconHandle | null>(null)
  // Widen the icon type locally so a ref can be attached; for static icons the
  // ref lands on an SVG element and the optional handle calls are no-ops.
  const Icon = icon as ComponentType<{ className?: string; ref?: Ref<AnimatedIconHandle | null> }>

  useEffect(() => {
    // Slight delay so the entrance animation is visible after first paint.
    const timer = setTimeout(() => iconRef.current?.startAnimation?.(), 250)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="flex flex-col items-center justify-center gap-group rounded-xl border border-dashed border-border p-empty text-center"
      onMouseEnter={() => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => iconRef.current?.stopAnimation?.()}
    >
      <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        <Icon ref={iconRef} />
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

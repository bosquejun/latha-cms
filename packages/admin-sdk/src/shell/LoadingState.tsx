/**
 * LoadingState — the standard page/panel-level loading indicator: a centered
 * spinner with an accessible status label. Use it wherever a view is waiting
 * on its initial data; in-flight button work uses the Button `loading` prop,
 * and views with a known layout may render `Skeleton`s instead.
 */
import { Spinner } from '@kon10/ui'

export interface LoadingStateProps {
  /** Visible label next to the spinner. Omitted, the label is screen-reader only. */
  label?: string
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-inline py-empty text-muted-foreground"
    >
      <Spinner className="size-5" />
      {label ? (
        <span className="text-small">{label}</span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  )
}

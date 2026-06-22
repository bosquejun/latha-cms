import * as React from 'react'

import { cn } from '@/lib/utils'

const SIZE = {
  sm: 'size-7 text-[0.7rem]',
  default: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const

export interface AvatarProps extends React.ComponentProps<'span'> {
  /** Image source. When omitted (or it fails to load), the fallback shows. */
  src?: string
  alt?: string
  /** Fallback content — typically initials. */
  fallback?: React.ReactNode
  size?: keyof typeof SIZE
}

/**
 * Avatar — circular image with an initials fallback. Dependency-free; falls
 * back automatically if the image is missing or errors.
 */
function Avatar({
  className,
  src,
  alt,
  fallback,
  size = 'default',
  ...props
}: AvatarProps) {
  const [errored, setErrored] = React.useState(false)
  const showImage = src && !errored

  return (
    <span
      data-slot="avatar"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground',
        SIZE[size],
        className,
      )}
      {...props}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        fallback
      )}
    </span>
  )
}

export { Avatar }

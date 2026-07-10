import { type ReactNode } from 'react'
import { Label } from './ui/label.js'

export interface FieldProps {
  htmlFor?: string
  label?: string
  required?: boolean
  description?: string
  error?: string
  children: ReactNode
}

/**
 * Vertical label + control + helper/error wrapper. A small composite over the
 * shadcn Label primitive — CMS-agnostic, used by Studio field renderers.
 */
export function Field({
  htmlFor,
  label,
  required,
  description,
  error,
  children,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-field">
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      {children}
      {description && !error && (
        <p className="text-muted-foreground text-caption">{description}</p>
      )}
      {error && <p className="text-destructive text-caption">{error}</p>}
    </div>
  )
}

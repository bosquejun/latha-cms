/**
 * Field renderer contract.
 *
 * Renderers are deliberately decoupled from any form library: they receive a
 * value + change/blur callbacks and the field definition. The form view adapts
 * its form state (react-hook-form, via Controller) to this contract, so
 * renderers stay simple and independently testable.
 */

import type { Field } from '@kon10/core'
import type { ReactNode } from 'react'

export interface FieldControlProps {
  /** The field definition from config. */
  field: Field
  /** Stable id for the control, linked to its label. */
  id: string
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  error?: string
}

export type FieldRenderer = (props: FieldControlProps) => ReactNode

/**
 * DocumentForm — edit a document singleton. Same engine as collections, just
 * always an upsert of the single record.
 */

import { EntityForm } from './EntityForm.js'
import type { AdminEntity } from '../schema.js'

export interface DocumentFormProps {
  entity: AdminEntity
  /** Current singleton value, if it has been saved before. */
  value?: Record<string, unknown> | null
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void
}

export function DocumentForm({ entity, value, onSubmit }: DocumentFormProps) {
  return (
    <EntityForm
      fields={entity.fields}
      initialValues={value ?? undefined}
      submitLabel="Save"
      onSubmit={onSubmit}
      entity={entity}
    />
  )
}

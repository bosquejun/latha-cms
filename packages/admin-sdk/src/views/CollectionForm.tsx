/**
 * CollectionForm — create/edit a collection record. Thin wrapper over
 * EntityForm; the heavy lifting (rendering, validation) is shared.
 */

import { EntityForm } from './EntityForm.js'
import type { AdminEntity } from '../schema.js'

export interface CollectionFormProps {
  entity: AdminEntity
  /** Existing record for edit; omit for create. */
  initialValues?: Record<string, unknown>
  /** Record id on edit; forwarded to `form.*` zone widgets. */
  recordId?: string
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void
  onCancel?: () => void
}

export function CollectionForm({
  entity,
  initialValues,
  recordId,
  onSubmit,
  onCancel,
}: CollectionFormProps) {
  return (
    <EntityForm
      fields={entity.fields}
      initialValues={initialValues}
      submitLabel={initialValues ? 'Save changes' : `Create ${entity.label}`}
      onSubmit={onSubmit}
      onCancel={onCancel}
      entity={entity}
      recordId={recordId}
    />
  )
}

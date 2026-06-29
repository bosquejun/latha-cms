/**
 * Field builders provided by @latha/content.
 *
 * `taxonomy()` lives here because the taxonomy field type is owned by this
 * module — it is registered in ContentModule.onInit and its builder belongs
 * alongside that registration, not in core.
 */

import type { FieldMeta, PhantomMeta } from '@latha/core'

interface TaxonomyOpts {
  to: string
  many?: boolean
  required?: boolean
  unique?: boolean
  defaultValue?: string | string[]
  meta?: FieldMeta
}

type RefOut<O extends TaxonomyOpts> = O extends { many: true } ? string[] : string

type IsPresent<O> = O extends { required: true }
  ? true
  : O extends { defaultValue: infer D }
    ? [D] extends [undefined]
      ? false
      : true
    : false

type TaxonomyBuilt<O extends TaxonomyOpts> = Omit<O, never> & {
  type: 'taxonomy'
} & PhantomMeta<RefOut<O>, IsPresent<O>>

/** Relationship to a taxonomy. `many: true` stores an array of term ids. */
export function taxonomy<const O extends TaxonomyOpts>(
  opts: O,
): TaxonomyBuilt<O> {
  return { ...opts, type: 'taxonomy' } as TaxonomyBuilt<O>
}

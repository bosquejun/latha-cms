/**
 * Field builders provided by @kon10/content.
 *
 * `taxonomy()` and `blocks()` live here because those field types are owned by
 * this module — registered in ContentModule.onInit and their builders belong
 * alongside that registration, not in core.
 */

import type { FieldMeta, PhantomMeta, FieldsRecord } from 'kon10'
import { stampFields } from 'kon10'
import type { Field } from 'kon10'

/* -------------------------------------------------------------------------- */
/*  taxonomy                                                                   */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  blocks                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What the developer writes when defining a block type.
 * `fields` is a FieldsRecord (name → builder result, no `name` key yet).
 */
export interface BlockInput {
  type: string
  label: string
  fields: FieldsRecord
}

/**
 * The processed form stored in the field config.
 * `fields` has been stamped — each entry is a full Field with `name` included.
 */
export interface BlockDefinition {
  type: string
  label: string
  fields: Field[]
}

interface BlocksOpts {
  blocks: BlockInput[]
  required?: boolean
  meta?: FieldMeta
}

type BlocksBuilt<O extends BlocksOpts> = {
  type: 'blocks'
  blocks: BlockDefinition[]
  required?: boolean
  meta?: FieldMeta
} & PhantomMeta<Array<Record<string, unknown>>, IsPresent<O>>

/**
 * A composable page-builder field: an ordered array of typed block objects.
 * Pass `blocks` from `@kon10/content` (heroBlock, ctaBlock, etc.) or define
 * your own inline.
 */
export function blocks<const O extends BlocksOpts>(opts: O): BlocksBuilt<O> {
  const { blocks: blockInputs, ...rest } = opts
  return {
    ...rest,
    type: 'blocks',
    blocks: blockInputs.map((b) => ({
      type: b.type,
      label: b.label,
      fields: stampFields(b.fields),
    })),
  } as BlocksBuilt<O>
}

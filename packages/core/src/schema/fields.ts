/**
 * Function-based field builders + document type inference.
 *
 * Instead of writing field definitions as plain objects, collections declare
 * their fields as a record of builder calls:
 *
 * ```ts
 * fields: {
 *   title:  text({ required: true }),
 *   status: select({ options: ['draft', 'published'], defaultValue: 'draft' }),
 *   views:  number({ integer: true, defaultValue: 0 }),
 * }
 * ```
 *
 * Each builder is a thin, statically-typed constructor: at runtime it returns
 * the same `Field` config the kernel has always consumed (minus `name`, which
 * is supplied by the record key via {@link stampFields}); at compile time it
 * carries phantom type info (`__out` / `__present`) so {@link InferDoc} can
 * derive the document's TypeScript shape — which then flows into `access` and
 * `hooks` callbacks and `z.infer`.
 *
 * Nothing downstream changes: factories call {@link stampFields} to produce the
 * existing `Field[]`, so the Zod builder, storage generator, admin layer, and
 * operations all keep consuming the same runtime shape.
 */

import type {
  ArrayField,
  BooleanField,
  DateField,
  Field,
  FieldAdminConfig,
  FieldType,
  GroupField,
  MediaField,
  NumberField,
  RelationshipField,
  RichTextField,
  SelectField,
  TaxonomyField,
  TextField,
} from '../types/field.js'

/* -------------------------------------------------------------------------- */
/*  Phantom carriers + inference                                              */
/* -------------------------------------------------------------------------- */

/**
 * Compile-time only metadata stamped onto a builder's return type.
 * `__out` is the field's parsed value type; `__present` is `true` when the
 * field is guaranteed present on the document (required, or has a default).
 * Neither key exists at runtime.
 */
interface FieldMeta<TOut, TPresent extends boolean> {
  /** @internal phantom — never present at runtime */
  readonly __out: TOut
  /** @internal phantom — never present at runtime */
  readonly __present: TPresent
}

/** A builder result: the runtime field config (sans `name`) + phantom meta. */
type Built<TField extends Field, TOut, TPresent extends boolean> = Omit<
  TField,
  'name'
> &
  FieldMeta<TOut, TPresent>

/** The loose, structural form every builder result satisfies. */
export interface AnyFieldDef extends FieldMeta<unknown, boolean> {
  readonly type: FieldType
  readonly required?: boolean
  readonly unique?: boolean
  readonly defaultValue?: unknown
  readonly admin?: FieldAdminConfig
}

/** A collection/group/array field set: name → builder result. */
export type FieldsRecord = Record<string, AnyFieldDef>

type OutputOf<D> = D extends FieldMeta<infer T, boolean> ? T : never
type PresentOf<D> = D extends FieldMeta<unknown, infer P> ? P : false

/** Pretty-print an intersection so editors show a flat object. */
type Prettify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Derive the document type from a fields record: present fields are required
 * keys, the rest are optional. Mirrors what the Zod schema parses to.
 */
export type InferDoc<TFields extends FieldsRecord> = Prettify<
  {
    [K in keyof TFields as PresentOf<TFields[K]> extends true
      ? K
      : never]: OutputOf<TFields[K]>
  } & {
    [K in keyof TFields as PresentOf<TFields[K]> extends true
      ? never
      : K]?: OutputOf<TFields[K]>
  }
>

/** `true` when a field is required or carries a (non-undefined) default. */
type IsPresent<O> = O extends { required: true }
  ? true
  : O extends { defaultValue: infer D }
    ? [D] extends [undefined]
      ? false
      : true
    : false

/* -------------------------------------------------------------------------- */
/*  Runtime: record → Field[]                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Convert a `{ name: builder() }` record into the kernel's `Field[]`, stamping
 * each record key as the field's `name`. The phantom meta keys don't exist at
 * runtime, so the spread carries only real config.
 */
export function stampFields(defs: FieldsRecord): Field[] {
  return Object.entries(defs).map(([name, def]) => ({
    name,
    ...(def as object),
  })) as Field[]
}

/* -------------------------------------------------------------------------- */
/*  Builder option types                                                       */
/* -------------------------------------------------------------------------- */

interface CommonOpts {
  required?: boolean
  unique?: boolean
  admin?: FieldAdminConfig
}

type TextOpts = CommonOpts & {
  minLength?: number
  maxLength?: number
  defaultValue?: string
}

type NumberOpts = CommonOpts & {
  min?: number
  max?: number
  integer?: boolean
  defaultValue?: number
}

type BooleanOpts = CommonOpts & { defaultValue?: boolean }

type DateOpts = CommonOpts & { defaultValue?: Date | string }

type SelectOpts = CommonOpts & {
  options: readonly string[]
  many?: boolean
  defaultValue?: string
}

type StringRefOpts = CommonOpts & {
  to: string
  many?: boolean
  defaultValue?: string | string[]
}

type GroupOpts = CommonOpts & { fields: FieldsRecord; defaultValue?: never }

type ArrayOpts = CommonOpts & { fields: FieldsRecord; defaultValue?: never }

type SelectOut<O extends SelectOpts> = O extends { many: true }
  ? O['options'][number][]
  : O['options'][number]

type RefOut<O extends StringRefOpts> = O extends { many: true }
  ? string[]
  : string

/* -------------------------------------------------------------------------- */
/*  Builders                                                                    */
/* -------------------------------------------------------------------------- */

/** Plain text — a single-line string field. */
export function text<const O extends TextOpts = {}>(
  opts?: O,
): Built<TextField, string, IsPresent<O>> {
  return { type: 'text', ...opts } as unknown as Built<
    TextField,
    string,
    IsPresent<O>
  >
}

/** Numeric field — optionally integer-constrained and bounded. */
export function number<const O extends NumberOpts = {}>(
  opts?: O,
): Built<NumberField, number, IsPresent<O>> {
  return { type: 'number', ...opts } as unknown as Built<
    NumberField,
    number,
    IsPresent<O>
  >
}

/** Boolean toggle. */
export function boolean<const O extends BooleanOpts = {}>(
  opts?: O,
): Built<BooleanField, boolean, IsPresent<O>> {
  return { type: 'boolean', ...opts } as unknown as Built<
    BooleanField,
    boolean,
    IsPresent<O>
  >
}

/** Date field — accepts `Date` or ISO string, parses to `Date`. */
export function date<const O extends DateOpts = {}>(
  opts?: O,
): Built<DateField, Date, IsPresent<O>> {
  return { type: 'date', ...opts } as unknown as Built<
    DateField,
    Date,
    IsPresent<O>
  >
}

/** Enumerated choice. `many: true` stores an array of the chosen options. */
export function select<const O extends SelectOpts>(
  opts: O,
): Built<SelectField, SelectOut<O>, IsPresent<O>> {
  return { type: 'select', ...opts } as unknown as Built<
    SelectField,
    SelectOut<O>,
    IsPresent<O>
  >
}

/** Rich text (HTML/markdown) — stored as a string. */
export function richtext<const O extends CommonOpts & { defaultValue?: string } = {}>(
  opts?: O,
): Built<RichTextField, string, IsPresent<O>> {
  return { type: 'richtext', ...opts } as unknown as Built<
    RichTextField,
    string,
    IsPresent<O>
  >
}

/** Media reference — stored as a media id / url string. */
export function media<const O extends CommonOpts & { defaultValue?: string } = {}>(
  opts?: O,
): Built<MediaField, string, IsPresent<O>> {
  return { type: 'media', ...opts } as unknown as Built<
    MediaField,
    string,
    IsPresent<O>
  >
}

/** Relationship to another collection. `many: true` stores an array of ids. */
export function relationship<const O extends StringRefOpts>(
  opts: O,
): Built<RelationshipField, RefOut<O>, IsPresent<O>> {
  return { type: 'relationship', ...opts } as unknown as Built<
    RelationshipField,
    RefOut<O>,
    IsPresent<O>
  >
}

/** Relationship to a taxonomy. `many: true` stores an array of term ids. */
export function taxonomy<const O extends StringRefOpts>(
  opts: O,
): Built<TaxonomyField, RefOut<O>, IsPresent<O>> {
  return { type: 'taxonomy', ...opts } as unknown as Built<
    TaxonomyField,
    RefOut<O>,
    IsPresent<O>
  >
}

/** A nested object of fields, stored inline as JSON. */
export function group<const O extends GroupOpts>(
  opts: O,
): Built<GroupField, InferDoc<O['fields']>, IsPresent<O>> {
  const { fields, ...rest } = opts
  return {
    type: 'group',
    fields: stampFields(fields),
    ...rest,
  } as unknown as Built<GroupField, InferDoc<O['fields']>, IsPresent<O>>
}

/** A repeatable list of a nested field set, stored as a JSON array. */
export function array<const O extends ArrayOpts>(
  opts: O,
): Built<ArrayField, InferDoc<O['fields']>[], IsPresent<O>> {
  const { fields, ...rest } = opts
  return {
    type: 'array',
    fields: stampFields(fields),
    ...rest,
  } as unknown as Built<ArrayField, InferDoc<O['fields']>[], IsPresent<O>>
}

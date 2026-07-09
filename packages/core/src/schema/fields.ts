/**
 * Function-based field builders + document type inference.
 *
 * Instead of writing field definitions as plain objects, entities declare
 * their fields as a record of builder calls:
 *
 * ```ts
 * fields: {
 *   title:  text({ required: true }),
 *   status: select({ options: z.enum(['draft', 'published']), defaultValue: 'draft' }),
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

import type { z } from 'zod'
import { kDataSchema } from '../fields/registry.js'
import type { FieldMeta } from '../fields/meta.js'
import type {
  ArrayField,
  BooleanField,
  DateField,
  Field,
  FieldType,
  GroupField,
  NumberField,
  RelationshipField,
  RichTextField,
  RichTextExtensions,
  SelectField,
  TextField,
} from '../fields/types.js'

/* -------------------------------------------------------------------------- */
/*  Phantom carriers + inference                                              */
/* -------------------------------------------------------------------------- */

/**
 * Compile-time only phantom type stamped onto a builder's return type.
 * `__out` is the field's parsed value type; `__present` is `true` when the
 * field is guaranteed present on the document (required, or has a default).
 * Neither key exists at runtime.
 */
export interface PhantomMeta<TOut, TPresent extends boolean> {
  /** @internal phantom — never present at runtime, hence optional */
  readonly __out?: TOut
  /** @internal phantom — never present at runtime, hence optional */
  readonly __present?: TPresent
}

/** A builder result: the runtime field config (sans `name`) + phantom meta. */
type Built<TField extends Field, TOut, TPresent extends boolean> = Omit<
  TField,
  'name'
> &
  PhantomMeta<TOut, TPresent>

/** The loose, structural form every builder result satisfies. */
export interface AnyFieldDef extends PhantomMeta<unknown, boolean> {
  readonly type: FieldType
  readonly required?: boolean
  readonly unique?: boolean
  readonly defaultValue?: unknown
  /** Display hints for the admin UI (label, placeholder, etc.). */
  readonly meta?: FieldMeta
}

/** An entity/group/array field set: name → builder result. */
export type FieldsRecord = Record<string, AnyFieldDef>

type OutputOf<D> = D extends PhantomMeta<infer T, boolean> ? T : never
type PresentOf<D> = D extends PhantomMeta<unknown, infer P> ? P : false

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
  meta?: FieldMeta
}

// text/number/date accept either literal constraints or a full Zod `schema`
// (mutually exclusive). The live schema is attached under the `kDataSchema`
// symbol — server-memory only, never serialized — and wins over the literal
// config in `buildDocumentSchema`. See `kDataSchema` in fields/registry.ts.
type TextOpts = CommonOpts & { defaultValue?: string } & (
    | { minLength?: number; maxLength?: number; schema?: never }
    | { schema: z.ZodType<string>; minLength?: never; maxLength?: never }
  )

type NumberOpts = CommonOpts & { defaultValue?: number } & (
    | { min?: number; max?: number; integer?: boolean; schema?: never }
    | { schema: z.ZodType<number>; min?: never; max?: never; integer?: never }
  )

type BooleanOpts = CommonOpts & { defaultValue?: boolean }

type DateOpts = CommonOpts & { defaultValue?: Date | string; schema?: z.ZodType<Date> }

// Zod-first: `options` is a `z.enum(...)` instance — the single source of
// truth for the choice set. The builder normalizes it to the literal
// `string[]` the kernel/wire config carries (see `select()` below).
type SelectOpts<T extends z.ZodEnum = z.ZodEnum> = CommonOpts & {
  options: T
  many?: boolean
  defaultValue?: z.infer<T> | readonly z.infer<T>[]
}

type StringRefOpts = CommonOpts & {
  to: string
  many?: boolean
  defaultValue?: string | string[]
}

type GroupOpts = CommonOpts & { fields: FieldsRecord; defaultValue?: never }

type ArrayOpts = CommonOpts & { fields: FieldsRecord; defaultValue?: never; useAsTitle?: string }

type SelectOut<T extends z.ZodEnum, O> = O extends { many: true }
  ? z.infer<T>[]
  : z.infer<T>

type RefOut<O extends StringRefOpts> = O extends { many: true }
  ? string[]
  : string

/* -------------------------------------------------------------------------- */
/*  Builders                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Attach the (compile-time only) `__out` / `__present` carriers to a runtime
 * field config. The config is checked against the real `Field` shape, and the
 * phantom keys are optional, so a plain config is assignable as-is — no `any`
 * or `unknown` assertion needed.
 */
function withMeta<TField extends Field, TOut, TPresent extends boolean>(
  config: Omit<TField, 'name'>,
): Built<TField, TOut, TPresent> {
  return config
}

/**
 * Attach a live data schema under the `kDataSchema` symbol. Symbol keys
 * survive the `stampFields` spread but are dropped by `JSON.stringify`, so
 * the schema never leaves server memory.
 */
function withDataSchema<C>(config: C, schema: z.ZodType | undefined): C {
  if (schema !== undefined) {
    ;(config as Record<symbol, unknown>)[kDataSchema] = schema
  }
  return config
}

/**
 * Plain text — a single-line string field. Pass `schema` (e.g. `z.email()`,
 * `z.string().regex(...)`) for constraints the literal options can't express.
 */
export function text<const O extends TextOpts = {}>(
  opts?: O,
): Built<TextField, string, IsPresent<O>> {
  const { schema, ...rest } = opts ?? ({} as O)
  return withDataSchema(
    withMeta<TextField, string, IsPresent<O>>({ type: 'text', ...rest }),
    schema,
  )
}

/** Numeric field — optionally integer-constrained and bounded, or a full `schema`. */
export function number<const O extends NumberOpts = {}>(
  opts?: O,
): Built<NumberField, number, IsPresent<O>> {
  const { schema, ...rest } = opts ?? ({} as O)
  return withDataSchema(
    withMeta<NumberField, number, IsPresent<O>>({ type: 'number', ...rest }),
    schema,
  )
}

/** Boolean toggle. */
export function boolean<const O extends BooleanOpts = {}>(
  opts?: O,
): Built<BooleanField, boolean, IsPresent<O>> {
  return withMeta<BooleanField, boolean, IsPresent<O>>({
    type: 'boolean',
    ...opts,
  })
}

/** Date field — accepts `Date` or ISO string, parses to `Date`. */
export function date<const O extends DateOpts = {}>(
  opts?: O,
): Built<DateField, Date, IsPresent<O>> {
  const { schema, ...rest } = opts ?? ({} as O)
  return withDataSchema(
    withMeta<DateField, Date, IsPresent<O>>({ type: 'date', ...rest }),
    schema,
  )
}

/**
 * Enumerated choice. `options` takes a `z.enum(...)`; `defaultValue` is
 * checked against the enum's values. `many: true` stores an array of the
 * chosen options.
 */
export function select<T extends z.ZodEnum, const O extends SelectOpts<T>>(
  opts: O & { options: T },
): Built<SelectField, SelectOut<T, O>, IsPresent<O>> {
  const { options, ...rest } = opts
  return withMeta<SelectField, SelectOut<T, O>, IsPresent<O>>({
    ...rest,
    type: 'select',
    // Normalize Zod in → JSON out: the canonical field config (what the
    // registry validates and `describe()` ships to the admin client) carries
    // the literal values, not the ZodEnum instance.
    options: [...options.options] as string[],
  })
}

type RichTextOpts = CommonOpts & { defaultValue?: string; lexicalConfig?: RichTextExtensions }

/** Rich text (HTML/markdown) — stored as a string. */
export function richtext<const O extends RichTextOpts = {}>(
  opts?: O,
): Built<RichTextField, string, IsPresent<O>> {
  return withMeta<RichTextField, string, IsPresent<O>>({
    type: 'richtext',
    ...opts,
  })
}

/** Relationship to another entity. `many: true` stores an array of ids. */
export function relationship<const O extends StringRefOpts>(
  opts: O,
): Built<RelationshipField, RefOut<O>, IsPresent<O>> {
  return withMeta<RelationshipField, RefOut<O>, IsPresent<O>>({
    ...opts,
    type: 'relationship',
  })
}

/** A nested object of fields, stored inline as JSON. */
export function group<const O extends GroupOpts>(
  opts: O,
): Built<GroupField, InferDoc<O['fields']>, IsPresent<O>> {
  const { fields, ...rest } = opts
  return withMeta<GroupField, InferDoc<O['fields']>, IsPresent<O>>({
    ...rest,
    type: 'group',
    fields: stampFields(fields),
  })
}

/** A repeatable list of a nested field set, stored as a JSON array. */
export function array<const O extends ArrayOpts>(
  opts: O,
): Built<ArrayField, InferDoc<O['fields']>[], IsPresent<O>> {
  const { fields, ...rest } = opts
  return withMeta<ArrayField, InferDoc<O['fields']>[], IsPresent<O>>({
    ...rest,
    type: 'array',
    fields: stampFields(fields),
  })
}

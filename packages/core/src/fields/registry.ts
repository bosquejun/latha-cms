import { z } from 'zod'
import { fieldMetaSchema } from './meta.js'

/**
 * Symbol key under which a field builder may stash a live Zod schema for the
 * field's stored value (the `schema` escape hatch on `text()`/`number()`/
 * `date()`). Symbol keys survive the `{ name, ...def }` spread in
 * `stampFields` but are invisible to `JSON.stringify`, so the live schema is
 * server-memory only — it never crosses the RPC wire. `buildDocumentSchema`
 * prefers it over the registered type's `buildDataSchema`, and
 * `@latha/start`'s `describe()` converts it to JSON Schema for the client.
 */
export const kDataSchema: unique symbol = Symbol('latha.kDataSchema')

/** Read a field config's live data schema, if a builder attached one. */
export function liveDataSchema(field: Record<string, unknown>): z.ZodType | undefined {
  const live = (field as Record<symbol, unknown>)[kDataSchema]
  return live instanceof z.ZodType ? live : undefined
}

export interface FieldTypeEntry {
  /**
   * Zod schema for the field definition object itself.
   * Must include `type: z.literal('<type-name>')` as the discriminant.
   * The base fields (name, required, unique, defaultValue, meta) are
   * merged in automatically — do not repeat them here.
   */
  configSchema: z.ZodObject<{ type: z.ZodLiteral<string> } & z.ZodRawShape>
  /**
   * Build the Zod schema for this field's stored document value.
   * Receives the fully-parsed field config (including base fields).
   * The registry is provided so recursive types (group, array) can call
   * `registry.buildDocumentSchema`.
   */
  buildDataSchema: (config: Record<string, unknown>, registry: FieldRegistry) => z.ZodType
}

export class FieldRegistry {
  private readonly entries = new Map<string, FieldTypeEntry>()

  register(entry: FieldTypeEntry): void {
    const typeLiteral = entry.configSchema.shape.type
    const type = typeLiteral.value
    if (this.entries.has(type)) {
      throw new Error(`Field type "${type}" is already registered.`)
    }
    this.entries.set(type, entry)
  }

  has(type: string): boolean {
    return this.entries.has(type)
  }

  /**
   * Build the document-data Zod schema from an array of parsed field configs.
   * This is the single validation layer for all CMS operations.
   */
  buildDocumentSchema(fields: Array<Record<string, unknown>>): z.ZodObject<z.ZodRawShape> {
    // v4's ZodRawShape is Readonly — build in a mutable record, pass to z.object.
    const shape: Record<string, z.ZodType> = {}

    for (const field of fields) {
      const type = field.type as string
      const entry = this.entries.get(type)
      // A live schema attached by a builder (the `schema` escape hatch) wins
      // over the registered type's buildDataSchema — it can carry refinements
      // the literal config can't express.
      const live = liveDataSchema(field)
      // Module-owned field types (e.g. 'blocks', 'taxonomy') are only registered
      // server-side via onInit. On the client, fall back to z.unknown() so the
      // form renders; real validation always runs on the server. The fallback
      // still goes through the default/optional layering below — v4 object
      // keys are non-optional even for z.unknown(), so skipping it would
      // reject absent optional fields.
      let schema = live ?? (entry ? entry.buildDataSchema(field, this) : z.unknown())

      const defaultValue = field.defaultValue
      if (defaultValue !== undefined) {
        schema = schema.default(defaultValue)
      } else if (!field.required) {
        // `undefined` (absent key) means "untouched" on a partial update;
        // `null` is the explicit "clear this field" sentinel — the only value
        // JSON can carry that survives `JSON.stringify` (which drops
        // `undefined`-valued keys outright).
        schema = schema.nullable().optional()
      }

      shape[field.name as string] = schema
    }

    return z.object(shape)
  }

  /**
   * Build a discriminated union of all registered field config schemas,
   * merged with the base field schema. Used to validate raw field definitions.
   */
  buildFieldConfigUnion(): z.ZodType {
    const [first, ...rest] = [...this.entries.values()].map((entry) =>
      baseFieldConfigSchema.extend(entry.configSchema.shape),
    )

    if (first === undefined) throw new Error('No field types registered.')
    return z.discriminatedUnion('type', [first, ...rest])
  }
}

/** Base properties present on every field config. */
export const baseFieldConfigSchema = z.object({
  name: z.string(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  meta: fieldMetaSchema.optional(),
})

export type BaseFieldConfig = z.infer<typeof baseFieldConfigSchema>

/** Singleton registry — populated at bootstrap by core builtins + module onInit calls. */
export const fieldRegistry = new FieldRegistry()

export function registerFieldType(entry: FieldTypeEntry): void {
  fieldRegistry.register(entry)
}

/**
 * Build a `z.ZodObject` from a list of field definitions.
 * Thin wrapper over `fieldRegistry.buildDocumentSchema` kept as a named
 * export so external consumers don't need to access the singleton directly.
 */
export function buildZodSchema(fields: Array<Record<string, unknown>>): z.ZodObject<z.ZodRawShape> {
  return fieldRegistry.buildDocumentSchema(fields)
}

/** Infer the TypeScript type of a built schema. */
export type InferFields<T extends z.ZodObject<z.ZodRawShape>> = z.infer<T>

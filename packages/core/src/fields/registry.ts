import { z } from 'zod'

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
  buildDataSchema: (config: Record<string, unknown>, registry: FieldRegistry) => z.ZodTypeAny
}

export class FieldRegistry {
  private readonly entries = new Map<string, FieldTypeEntry>()

  register(entry: FieldTypeEntry): void {
    const typeLiteral = entry.configSchema.shape.type
    const type = typeLiteral._def.value as string
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
    const shape: z.ZodRawShape = {}

    for (const field of fields) {
      const type = field.type as string
      const entry = this.entries.get(type)
      // Module-owned field types (e.g. 'blocks', 'taxonomy') are only registered
      // server-side via onInit. On the client, fall back to z.unknown() so the
      // form renders; real validation always runs on the server.
      if (!entry) {
        shape[field.name as string] = z.unknown()
        continue
      }

      let schema = entry.buildDataSchema(field, this)

      const defaultValue = field.defaultValue
      if (defaultValue !== undefined) {
        schema = schema.default(defaultValue)
      } else if (!field.required) {
        schema = schema.optional()
      }

      shape[field.name as string] = schema
    }

    return z.object(shape)
  }

  /**
   * Build a discriminated union of all registered field config schemas,
   * merged with the base field schema. Used to validate raw field definitions.
   */
  buildFieldConfigUnion(): z.ZodTypeAny {
    const schemas = [...this.entries.values()].map((entry) =>
      baseFieldConfigSchema.merge(entry.configSchema),
    ) as unknown as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]]

    if (schemas.length === 0) throw new Error('No field types registered.')
    return z.discriminatedUnion('type', schemas)
  }
}

/** Base properties present on every field config. */
export const baseFieldConfigSchema = z.object({
  name: z.string(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  meta: z
    .object({
      label: z.string().optional(),
      description: z.string().optional(),
      placeholder: z.string().optional(),
      hidden: z.boolean().optional(),
      sidebar: z.boolean().optional(),
      prefix: z.string().optional(),
      suffix: z.string().optional(),
      inputType: z.string().optional(),
    })
    .optional(),
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

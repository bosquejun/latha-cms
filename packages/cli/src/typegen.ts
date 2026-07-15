/**
 * Turn a delivery manifest into a `.ts` module of per-entity Zod schemas and
 * inferred types. The emitted Zod mirrors core's `buildDocumentSchema`
 * field-by-field so a consumer validating a delivery response gets exactly what
 * the server validated: each declared field maps to its type's data schema,
 * then is wrapped `.default(v)` when a default exists, else `.nullable().optional()`
 * when not `required`. Implicit `id` (and `createdAt`/`updatedAt` when the
 * entity keeps timestamps) are added as strings, since the delivery API returns
 * them over JSON.
 *
 * Field types core doesn't ship (module-registered types the manifest can't
 * describe structurally) fall back to `z.unknown()`, exactly as the server's
 * client-side schema does — real validation still runs server-side.
 */
import type { Manifest, ManifestEntity } from './manifest.js'

type Field = Record<string, unknown>

const pad = (depth: number) => '  '.repeat(depth)

/** A JS string literal for `value`. */
const str = (value: string) => JSON.stringify(value)

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** An object property key — bare when a valid identifier, else quoted. */
function propKey(name: string): string {
  return IDENT.test(name) ? name : str(name)
}

/** Split a slug into word parts on any non-alphanumeric boundary. */
function words(slug: string): string[] {
  return slug.split(/[^A-Za-z0-9]+/).filter(Boolean)
}

function pascal(slug: string): string {
  const name = words(slug)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  return /^[A-Za-z_]/.test(name) ? name : `Entity${name}`
}

function camel(slug: string): string {
  const p = pascal(slug)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

/** Reserve `base`, suffixing `_2`, `_3`, … if it was already taken. */
function unique(base: string, used: Set<string>): string {
  let name = base
  let n = 2
  while (used.has(name)) name = `${base}_${n++}`
  used.add(name)
  return name
}

/** The Zod expression for one field's stored value (before optional/default wrapping). */
function fieldTypeSource(field: Field, depth: number): string {
  const type = field.type as string
  switch (type) {
    case 'text': {
      let s = 'z.string()'
      if (field.minLength != null) s += `.min(${Number(field.minLength)})`
      if (field.maxLength != null) s += `.max(${Number(field.maxLength)})`
      return s
    }
    case 'number': {
      let s = field.integer ? 'z.number().int()' : 'z.number()'
      if (field.min != null) s += `.min(${Number(field.min)})`
      if (field.max != null) s += `.max(${Number(field.max)})`
      return s
    }
    case 'boolean':
      return 'z.boolean()'
    case 'date':
      return 'z.coerce.date()'
    case 'select': {
      const options = Array.isArray(field.options) ? (field.options as string[]) : []
      const base = options.length > 0 ? `z.enum([${options.map(str).join(', ')}])` : 'z.string()'
      return field.many ? `z.array(${base})` : base
    }
    case 'richtext':
      return 'z.string()'
    case 'relationship':
    case 'taxonomy':
      return field.many ? 'z.array(z.string())' : 'z.string()'
    case 'media':
      return 'z.string()'
    case 'group':
      return objectSource((field.fields as Field[]) ?? [], depth)
    case 'array':
      return `z.array(${objectSource((field.fields as Field[]) ?? [], depth)})`
    default:
      // Module-registered type the manifest can't describe — mirror the
      // server's client-side fallback. Real validation runs server-side.
      return 'z.unknown()'
  }
}

/** Wrap a value schema with `.default(...)` / `.nullable().optional()`, matching core. */
function wrap(expr: string, field: Field): string {
  if (field.defaultValue !== undefined) return `${expr}.default(${JSON.stringify(field.defaultValue)})`
  if (!field.required) return `${expr}.nullable().optional()`
  return expr
}

/** A `z.object({ … })` source for a list of declared field configs. */
function objectSource(fields: Field[], depth: number): string {
  if (fields.length === 0) return 'z.object({})'
  const lines = fields.map(
    (f) => `${pad(depth + 1)}${propKey(f.name as string)}: ${wrap(fieldTypeSource(f, depth + 1), f)},`,
  )
  return `z.object({\n${lines.join('\n')}\n${pad(depth)}})`
}

/** The top-level entity schema source: implicit `id`, declared fields, timestamps. */
function entitySchemaSource(entity: ManifestEntity): string {
  const lines: string[] = [`${pad(1)}id: z.string(),`]
  for (const field of entity.fields as Field[]) {
    lines.push(`${pad(1)}${propKey(field.name as string)}: ${wrap(fieldTypeSource(field, 1), field)},`)
  }
  if (entity.timestamps) {
    lines.push(`${pad(1)}createdAt: z.string(),`)
    lines.push(`${pad(1)}updatedAt: z.string(),`)
  }
  return `z.object({\n${lines.join('\n')}\n})`
}

export interface GenerateOptions {
  /** Header note naming how the file was produced. */
  source?: string
}

/** Generate the full `kon10.gen.ts` source from a manifest. */
export function generateTypes(manifest: Manifest, options: GenerateOptions = {}): string {
  const used = new Set<string>(['z', 'entities', 'Entities'])
  const usedTypes = new Set<string>()

  const blocks: string[] = []
  const mapEntries: string[] = []

  for (const entity of [...manifest.entities].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const schemaName = unique(`${camel(entity.slug)}Schema`, used)
    const typeName = unique(pascal(entity.slug), usedTypes)
    const path = `${entity.prefix}/${entity.slug}`
    blocks.push(
      `export const ${schemaName} = ${entitySchemaSource(entity)}\n` +
        `export type ${typeName} = z.infer<typeof ${schemaName}>`,
    )
    mapEntries.push(`  ${str(path)}: ${schemaName},`)
  }

  const header =
    `// Generated by \`kon10 typegen\`${options.source ? ` from ${options.source}` : ''}. Do not edit.\n` +
    `/* eslint-disable */\n` +
    `import { z } from 'zod'\n`

  const map =
    `/** Delivery-path → schema, for \`createDeliveryClient().list(path, { schema: entities[path] })\`. */\n` +
    `export const entities = {\n${mapEntries.join('\n')}\n} as const\n` +
    `export type Entities = typeof entities`

  return `${header}\n${blocks.join('\n\n')}\n\n${map}\n`
}

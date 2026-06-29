/**
 * @latha/core — types, `defineConfig()`, module registry, hook engine,
 * access evaluator, and the Zod schema builder.
 *
 * This package is the kernel. It has no knowledge of any specific database,
 * storage backend, or UI. Everything is composed through the interfaces here.
 */

// Types
export * from './types/index.js'

// Field builders + document type inference
export {
  text,
  number,
  boolean,
  date,
  select,
  richtext,
  relationship,
  group,
  array,
  stampFields,
  type PhantomMeta,
  type AnyFieldDef,
  type FieldsRecord,
  type InferDoc,
} from './schema/fields.js'

// Access control
export {
  evaluateAccess,
  assertAccess,
  AccessDeniedError,
} from './access/evaluator.js'

// Hooks
export { runHooks, runHookEvent } from './hooks/engine.js'

// Registry
export { ModuleRegistry } from './registry/index.js'

// Field type registry + canonical field types (extensibility seam for modules)
export {
  type FieldMeta,
  type FieldTypeEntry,
  FieldRegistry,
  baseFieldConfigSchema,
  type BaseFieldConfig,
  fieldRegistry,
  registerFieldType,
  type FieldTypeMap,
  type FieldFromMap,
  type FieldTypeKey,
  // Canonical aliases — widen as modules augment FieldTypeMap
  type Field,
  type FieldType,
  // Convenience aliases for built-in field config types
  type TextField,
  type NumberField,
  type BooleanField,
  type DateField,
  type SelectField,
  type RichTextField,
  type RelationshipField,
  type GroupField,
  type ArrayField,
  buildZodSchema,
  type InferFields,
} from './fields/index.js'

// Bootstrap
export { defineConfig, bootstrapLatha } from './bootstrap/index.js'

// Operations (local API)
export * as operations from './operations/index.js'
export type { OperationContext } from './operations/index.js'

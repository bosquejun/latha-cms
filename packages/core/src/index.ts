/**
 * @latha/core — types, `defineConfig()`, module registry, hook engine,
 * access evaluator, and the Zod schema builder.
 *
 * This package is the kernel. It has no knowledge of any specific database,
 * storage backend, or UI. Everything is composed through the interfaces here.
 */

// Types
export * from './types/index.js'

// Schema bridge
export { buildZodSchema, type InferFields } from './schema/builder.js'

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

// Bootstrap
export { defineConfig, bootstrapCMS } from './bootstrap/index.js'

// Operations (local API)
export * as operations from './operations/index.js'
export type { OperationContext } from './operations/index.js'

/**
 * ContentModule — the module that contributes content entities to the kernel.
 *
 * It simply collects the `Collection` / `Document` / `Taxonomy` entities it is
 * given and exposes them through the standard `Module.entities` contract,
 * so the registry, migration, and operations layers pick them up without any
 * content-specific plumbing.
 *
 * `onInit` registers the `taxonomy` and `blocks` field types with the kernel's
 * field registry, since those types are owned by this module.
 */

import { z } from 'zod'
import { type Module, type AnyEntity, type Kon10Instance } from '@kon10/core'
import type { BlockDefinition } from './builders.js'

export interface ContentModuleConfig {
  entities: AnyEntity[]
  /**
   * Base path segment this module's entities are mounted under in the public
   * delivery API (`/api/v1/<apiPrefix>/<entitySlug>`). Defaults to the
   * module's own name (`content`) — set this if you'd rather it read e.g.
   * `/api/v1/contents/posts`.
   */
  apiPrefix?: string
}

// Exported so `index.ts` can derive the `FieldTypeMap` augmentation via
// `z.infer` instead of hand-duplicating the shape.
export const taxonomyFieldConfigSchema = z.object({
  type: z.literal('taxonomy'),
  to: z.string(),
  many: z.boolean().optional(),
})

// `blocks` is validated loosely at runtime (`fields: z.array(z.record(...))`):
// the field registry is open/extensible, so a fully faithful schema can't be
// expressed statically here. The `FieldTypeMap` augmentation in `index.ts`
// overrides `blocks` back to `BlockDefinition[]` for compile-time ergonomics.
export const blocksFieldConfigSchema = z.object({
  type: z.literal('blocks'),
  blocks: z.array(
    z.object({
      type: z.string(),
      label: z.string(),
      fields: z.array(z.record(z.string(), z.unknown())),
    }),
  ),
})

export function ContentModule(config: ContentModuleConfig): Module {
  return {
    name: 'content',
    capabilities: ['content'],
    studio: { nav: { label: 'Content', order: 10 }, ui: '@kon10/content/studio' },
    api: config.apiPrefix ? { prefix: config.apiPrefix } : undefined,
    entities: config.entities,
    onInit(cms: Kon10Instance) {
      cms.registerFieldType({
        configSchema: taxonomyFieldConfigSchema,
        buildDataSchema: (config) =>
          (config.many as boolean | undefined) ? z.array(z.string()) : z.string(),
      })

      cms.registerFieldType({
        configSchema: blocksFieldConfigSchema,
        buildDataSchema: (config, registry) => {
          const defs = config.blocks as BlockDefinition[]
          if (!defs || defs.length === 0) {
            return z.array(z.object({ type: z.string() }))
          }
          const variants = defs.map((def) => {
            const bodySchema = registry.buildDocumentSchema(
              def.fields as Array<Record<string, unknown>>,
            )
            return z.object({ type: z.literal(def.type), ...bodySchema.shape })
          })
          const [first, ...rest] = variants
          if (first === undefined) return z.array(z.object({ type: z.string() }))
          return z.array(z.discriminatedUnion('type', [first, ...rest]))
        },
      })
    },
  }
}

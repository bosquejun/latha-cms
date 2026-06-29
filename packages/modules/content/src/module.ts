/**
 * ContentModule — the module that contributes content entities to the kernel.
 *
 * It simply collects the `Collection` / `Document` / `Taxonomy` entities it is
 * given and exposes them through the standard `Module.entities` contract,
 * so the registry, migration, and operations layers pick them up without any
 * content-specific plumbing.
 *
 * `onInit` registers the `taxonomy` field type with the kernel's field registry,
 * since that type is owned by this module.
 */

import { z } from 'zod'
import { type Module, type Entity, registerFieldType } from '@latha/core'

export interface ContentModuleConfig {
  entities: Entity[]
}

export function ContentModule(config: ContentModuleConfig): Module {
  return {
    name: 'content',
    capabilities: ['content'],
    admin: { nav: { label: 'Content', order: 10, collapsible: true } },
    entities: config.entities,
    onInit() {
      registerFieldType({
        configSchema: z.object({
          type: z.literal('taxonomy'),
          to: z.string(),
          many: z.boolean().optional(),
        }),
        buildDataSchema: (config) =>
          (config.many as boolean | undefined) ? z.array(z.string()) : z.string(),
      })
    },
  }
}

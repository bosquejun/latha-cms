/**
 * ContentModule — the module that contributes content entities to the kernel.
 *
 * It simply collects the `Collection` / `Document` / `Taxonomy` entities it is
 * given and exposes them through the standard `CMSModule.entities` contract,
 * so the registry, migration, and operations layers pick them up without any
 * content-specific plumbing.
 */

import type { CMSModule, Entity } from '@latha/core'

export interface ContentModuleConfig {
  entities: Entity[]
}

export function ContentModule(config: ContentModuleConfig): CMSModule {
  return {
    name: 'content',
    capabilities: ['content'],
    entities: config.entities,
  }
}

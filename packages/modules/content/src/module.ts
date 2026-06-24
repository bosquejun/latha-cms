/**
 * ContentModule — the module that contributes content entities to the kernel.
 *
 * It simply collects the `Collection` / `Document` / `Taxonomy` entities it is
 * given and exposes them through the standard `Module.entities` contract,
 * so the registry, migration, and operations layers pick them up without any
 * content-specific plumbing.
 */

import type { Module, Entity } from '@latha/core'

export interface ContentModuleConfig {
  entities: Entity[]
}

export function ContentModule(config: ContentModuleConfig): Module {
  return {
    name: 'content',
    capabilities: ['content'],
    admin: { nav: { label: 'Content', order: 10, icon: 'layers', collapsible: true } },
    entities: config.entities,
  }
}

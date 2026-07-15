/**
 * Zod schemas for the shadcn registry formats we produce. These are a
 * permissive superset of the published schemas
 * (`https://ui.shadcn.com/schema/registry.json` /
 * `.../registry-item.json`): we validate the fields we rely on and pass
 * everything else through, so a valid item is never rejected for carrying a
 * field we don't model yet. The consumer's `shadcn` CLI validates on its side.
 */
import { z } from 'zod'

export const REGISTRY_SCHEMA_URL = 'https://ui.shadcn.com/schema/registry.json'
export const REGISTRY_ITEM_SCHEMA_URL = 'https://ui.shadcn.com/schema/registry-item.json'

/** One file shipped by an item. `content` is inlined by the build. */
export const registryFileSchema = z.looseObject({
  /** Path to the source file, relative to the registry's `items/` root. */
  path: z.string(),
  /** Registry file kind, e.g. `registry:lib`, `registry:page`, `registry:file`. */
  type: z.string(),
  /** Where to place the file in the consumer project (required for file/page kinds). */
  target: z.string().optional(),
  /** Inlined file contents — set by the build; absent in the source index. */
  content: z.string().optional(),
})

/** A registry item (the JSON a consumer installs via `npx shadcn add <url>`). */
export const registryItemSchema = z.looseObject({
  $schema: z.string().optional(),
  name: z.string(),
  type: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  files: z.array(registryFileSchema).optional(),
  cssVars: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  css: z.looseObject({}).optional(),
  tailwind: z.looseObject({}).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  docs: z.string().optional(),
  categories: z.array(z.string()).optional(),
})
export type RegistryItem = z.infer<typeof registryItemSchema>

/**
 * An item as authored in this registry's source index — a registry item plus
 * the `framework` namespace it belongs to (our own metadata, stripped from the
 * emitted item JSON and used only to place the output under `r/<framework>/`).
 */
export const sourceItemSchema = registryItemSchema.extend({
  framework: z.string(),
})
export type SourceItem = z.infer<typeof sourceItemSchema>

/** The source index (`registry.json`) the build reads. */
export const registryIndexSchema = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  homepage: z.string(),
  items: z.array(sourceItemSchema),
})
export type RegistryIndex = z.infer<typeof registryIndexSchema>

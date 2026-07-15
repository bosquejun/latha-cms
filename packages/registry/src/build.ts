/**
 * Build the distributable registry from the source index (`registry.json`) and
 * the item source files under `items/`. For each authored item it inlines every
 * file's contents and emits a shadcn `registry-item.json` at
 * `public/r/<framework>/<name>.json`, plus a flat `public/r/index.json` catalog
 * for discovery. A consumer then installs one with
 * `npx shadcn@latest add <host>/r/<framework>/<name>.json`.
 *
 * `buildItems` / `buildCatalog` are pure (they take a file reader) so the
 * transform is unit-tested without touching disk; `main` wires them to the fs.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  registryIndexSchema,
  registryItemSchema,
  REGISTRY_ITEM_SCHEMA_URL,
  type RegistryIndex,
  type RegistryItem,
} from './schema.js'

export interface BuiltItem {
  framework: string
  name: string
  /** Output path relative to the registry root, e.g. `r/tanstack/kon10-client.json`. */
  outputPath: string
  item: RegistryItem
}

/** Emit the registry items from a validated index, inlining each file's content. */
export function buildItems(
  index: RegistryIndex,
  readItemFile: (relPath: string) => string,
): BuiltItem[] {
  return index.items.map((source) => {
    const { framework, ...rest } = source
    const files = rest.files?.map((file) => ({
      ...file,
      content: file.content ?? readItemFile(file.path),
    }))
    // Re-validate the emitted item (framework stripped, content inlined).
    const item = registryItemSchema.parse({
      $schema: REGISTRY_ITEM_SCHEMA_URL,
      ...rest,
      ...(files ? { files } : {}),
    })
    return {
      framework,
      name: source.name,
      outputPath: `r/${framework}/${source.name}.json`,
      item,
    }
  })
}

/** A flat catalog of every built item, for a gallery / discovery endpoint. */
export function buildCatalog(index: RegistryIndex, built: BuiltItem[]) {
  return {
    name: index.name,
    homepage: index.homepage,
    items: built.map((b) => ({
      name: b.name,
      framework: b.framework,
      type: b.item.type,
      title: b.item.title,
      description: b.item.description,
      file: `${b.framework}/${b.name}.json`,
    })),
  }
}

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

async function main(): Promise<void> {
  const raw: unknown = JSON.parse(await readFile(join(packageRoot, 'registry.json'), 'utf8'))
  const index = registryIndexSchema.parse(raw)
  const read = (rel: string) => readFileSync(join(packageRoot, 'items', rel), 'utf8')
  const built = buildItems(index, read)

  const publicRoot = join(packageRoot, 'public')
  for (const b of built) {
    const dest = join(publicRoot, b.outputPath)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, JSON.stringify(b.item, null, 2) + '\n', 'utf8')
  }
  const catalogPath = join(publicRoot, 'r', 'index.json')
  await mkdir(dirname(catalogPath), { recursive: true })
  await writeFile(catalogPath, JSON.stringify(buildCatalog(index, built), null, 2) + '\n', 'utf8')

  console.log(`[registry] built ${built.length} item(s):`)
  for (const b of built) console.log(`  ${b.outputPath}`)
}

// Run only when invoked directly (`node dist/build.js`), not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}

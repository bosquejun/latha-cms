import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildItems, buildCatalog } from './build.js'
import { registryIndexSchema } from './schema.js'

const index = registryIndexSchema.parse({
  name: 'kon10',
  homepage: 'https://example.com',
  items: [
    {
      framework: 'tanstack',
      name: 'kon10-client',
      type: 'registry:lib',
      title: 'Kon10 delivery client',
      dependencies: ['@kon10/client'],
      files: [{ path: 'tanstack/lib/kon10.ts', type: 'registry:lib', target: 'src/lib/kon10.ts' }],
    },
  ],
})

test('buildItems inlines file content and namespaces output by framework', () => {
  const built = buildItems(index, (p) => `// file at ${p}\n`)
  assert.equal(built.length, 1)
  const b = built[0]!
  assert.equal(b.outputPath, 'r/tanstack/kon10-client.json')
  assert.equal(b.item.name, 'kon10-client')
  assert.equal(b.item.$schema, 'https://ui.shadcn.com/schema/registry-item.json')
  // `framework` is our own metadata — it must not leak into the emitted item.
  assert.equal('framework' in b.item, false)
  assert.deepEqual(b.item.dependencies, ['@kon10/client'])
  assert.equal(b.item.files![0]!.content, '// file at tanstack/lib/kon10.ts\n')
  assert.equal(b.item.files![0]!.target, 'src/lib/kon10.ts')
})

test('buildCatalog lists each item with its hosted path', () => {
  const built = buildItems(index, () => '')
  const catalog = buildCatalog(index, built)
  assert.equal(catalog.name, 'kon10')
  assert.deepEqual(catalog.items[0], {
    name: 'kon10-client',
    framework: 'tanstack',
    type: 'registry:lib',
    title: 'Kon10 delivery client',
    description: undefined,
    file: 'tanstack/kon10-client.json',
  })
})

test('an item missing required fields is rejected by the index schema', () => {
  assert.throws(() =>
    registryIndexSchema.parse({
      name: 'x',
      homepage: 'y',
      items: [{ framework: 'tanstack', title: 'no name or type' }],
    }),
  )
})

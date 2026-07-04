import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fieldRegistry, type FieldTypeEntry, type LathaInstance } from '@latha/core'
import { MediaModule } from './module.js'
import { MEDIA_SLUG } from './entities.js'

function fakeCms(storage?: unknown): LathaInstance {
  return {
    storage,
    registerFieldType: (entry: FieldTypeEntry) => fieldRegistry.register(entry),
  } as unknown as LathaInstance
}

test('MediaModule contributes the media entity with grantable actions', () => {
  const mod = MediaModule()
  const mediaEntity = mod.entities?.find((e) => e.slug === MEDIA_SLUG)
  assert.ok(mediaEntity)
  assert.deepEqual(mediaEntity.actions, ['read', 'create', 'update', 'delete'])
})

test('MediaModule.onInit throws without a configured storage adapter', () => {
  const mod = MediaModule()
  assert.throws(() => mod.onInit?.(fakeCms(undefined)))
})

test('MediaModule.onInit registers the media field type', async () => {
  const mod = MediaModule()
  await mod.onInit?.(fakeCms({ upload: async () => ({ url: '', key: '' }), delete: async () => {} }))
  assert.ok(fieldRegistry.has('media'))
  const built = fieldRegistry.buildDocumentSchema([{ name: 'cover', type: 'media', required: true }])
  const cover = built.shape.cover
  assert.ok(cover)
  assert.equal(cover._def.typeName, 'ZodString')
  assert.equal(cover.safeParse('doc-id').success, true)
})

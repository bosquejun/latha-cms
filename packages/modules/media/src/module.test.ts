import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fieldRegistry, type FieldTypeEntry, type LathaInstance, type StorageAdapter } from '@latha/core'
import { MediaModule } from './module.js'
import { MEDIA_SLUG } from './entities.js'

const fakeStorage: StorageAdapter = {
  async upload() { return { url: '', key: '' } },
  async delete() {},
}

function fakeCms(): LathaInstance & { registeredStorage?: StorageAdapter } {
  const cms = {
    registerFieldType: (entry: FieldTypeEntry) => fieldRegistry.register(entry),
    registerStorageAdapter(adapter: StorageAdapter) {
      cms.registeredStorage = adapter
      cms.storage = adapter
    },
  } as unknown as LathaInstance & { registeredStorage?: StorageAdapter }
  return cms
}

test('MediaModule contributes the media entity with grantable actions', () => {
  const mod = MediaModule({ storage: fakeStorage })
  const mediaEntity = mod.entities?.find((e) => e.slug === MEDIA_SLUG)
  assert.ok(mediaEntity)
  assert.deepEqual(mediaEntity.actions, ['read', 'create', 'update', 'delete'])
})

test('MediaModule.onInit registers the storage adapter and the media field type', async () => {
  const mod = MediaModule({ storage: fakeStorage })
  const cms = fakeCms()
  await mod.onInit?.(cms)

  assert.equal(cms.registeredStorage, fakeStorage)

  assert.ok(fieldRegistry.has('media'))
  const built = fieldRegistry.buildDocumentSchema([{ name: 'cover', type: 'media', required: true }])
  const cover = built.shape.cover
  assert.ok(cover)
  assert.equal(cover._def.typeName, 'ZodString')
  assert.equal(cover.safeParse('doc-id').success, true)
})

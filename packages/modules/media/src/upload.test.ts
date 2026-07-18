import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapKon10, defineConfig, type DBAdapter, type Kon10Instance } from 'kon10'
import { MediaModule } from './module.js'
import { uploadRoute } from './upload.js'
import { MEDIA_SLUG } from './entities.js'

function fakeDb(): DBAdapter {
  const rows = new Map<string, Record<string, unknown>>()
  let nextId = 1
  return {
    async find() { return [...rows.values()] as never },
    async findOne(_slug, id) { return (rows.get(id) as never) ?? null },
    async count() { return rows.size },
    async create(_slug, data) {
      const doc = { id: String(nextId++), ...data }
      rows.set(doc.id, doc)
      return doc as never
    },
    async update(_slug, id, data) {
      const doc = { ...(rows.get(id) ?? {}), ...data, id }
      rows.set(id, doc)
      return doc as never
    },
    async delete(_slug, id) { rows.delete(id) },
    async migrate() {},
  }
}

const fakeStorage = {
  async upload(file: File) { return { url: `mem://${file.name}`, key: file.name } },
  async delete() {},
}

async function bootMedia(): Promise<Kon10Instance> {
  const config = defineConfig({
    db: fakeDb(),
    modules: [MediaModule({ storage: fakeStorage, allowedMimeTypes: ['image/*'], maxFileSize: 1024 })],
  })
  return bootstrapKon10(config)
}

// Booted once and shared: the field-type registry is a process-wide
// singleton, and `onInit` registers the `media` field type — booting a
// second `MediaModule` instance in the same process would collide on it.
const cms = await bootMedia()

test('uploadRoute rejects a request with no file', async () => {
  const request = new Request('http://localhost/__kon10/modules/media/upload', {
    method: 'POST',
    body: new FormData(),
  })
  await assert.rejects(
    async () => uploadRoute.handler({ cms, principal: {}, request }),
    /must include a "file" field/,
  )
})

test('uploadRoute rejects a disallowed MIME type', async () => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' }))
  const request = new Request('http://localhost/__kon10/modules/media/upload', { method: 'POST', body: form })
  await assert.rejects(
    async () => uploadRoute.handler({ cms, principal: {}, request }),
    /not allowed for upload/,
  )
})

test('uploadRoute rejects a file over the configured size limit', async () => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(2048)], 'a.png', { type: 'image/png' }))
  const request = new Request('http://localhost/__kon10/modules/media/upload', { method: 'POST', body: form })
  await assert.rejects(
    async () => uploadRoute.handler({ cms, principal: {}, request }),
    /upload limit/,
  )
})

test('uploadRoute stores the file and creates the media doc', async () => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }))
  form.append('alt', 'A picture')
  const request = new Request('http://localhost/__kon10/modules/media/upload', { method: 'POST', body: form })

  const res = await uploadRoute.handler({ cms, principal: {}, request })
  assert.equal(res.status, 200)
  const doc = (await res.json()) as Record<string, unknown>
  assert.equal(doc['filename'], 'a.png')
  assert.equal(doc['mimeType'], 'image/png')
  assert.equal(doc['alt'], 'A picture')
  assert.equal(doc['url'], 'mem://a.png')

  assert.ok(cms.getEntity(MEDIA_SLUG))
})

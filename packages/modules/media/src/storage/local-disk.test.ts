import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { localDiskStorage } from './local-disk.js'

test('localDiskStorage writes the file and returns a url/key', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'latha-media-'))
  const storage = localDiskStorage({ dir, publicPath: '/uploads' })
  const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })

  const { url, key } = await storage.upload(file)

  assert.match(url, /^\/uploads\/.+-photo\.jpg$/)
  assert.equal(key, url.slice('/uploads/'.length))
  const written = await readFile(path.join(dir, key))
  assert.deepEqual([...written], [1, 2, 3])

  await storage.delete(key)
  await assert.rejects(() => stat(path.join(dir, key)))
})

test('delete is idempotent for a missing key', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'latha-media-'))
  const storage = localDiskStorage({ dir })
  await storage.delete('nonexistent-key') // must not throw
})

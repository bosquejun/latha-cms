import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dispatchLathaUpload } from './upload.js'
import type { ResolvedConfig } from '@latha/core'

// Minimal fake config: no auth module wired, so resolvePrincipal falls back
// to the public principal, which never holds ADMIN_ACCESS — asserts the
// access-denied path without needing a real session.
test('dispatchLathaUpload rejects unauthenticated requests', async () => {
  const config = {
    db: {
      find: async () => [], findOne: async () => null, count: async () => 0,
      create: async (_c: string, d: Record<string, unknown>) => ({ id: '1', ...d }),
      update: async (_c: string, id: string, d: Record<string, unknown>) => ({ id, ...d }),
      delete: async () => {}, migrate: async () => {},
    },
    modules: [],
    plugins: [],
    adminPath: '/admin',
  } as unknown as ResolvedConfig

  const form = new FormData()
  form.append('file', new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }))
  const request = new Request('http://localhost/__latha/upload', { method: 'POST', body: form })

  await assert.rejects(() => dispatchLathaUpload(config, request))
})

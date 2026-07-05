// packages/start/src/vite.admin-extensions.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readModuleUiSpecifiers, buildModuleSource } from './vite.js'

test('readModuleUiSpecifiers extracts and de-dupes module admin.ui strings', async () => {
  const fakeLoad = async () => ({
    default: {
      modules: [
        { name: 'users' },
        { name: 'auth', admin: { ui: '@latha/auth/admin' } },
        { name: 'auth2', admin: { ui: '@latha/auth/admin' } }, // dup
        { name: 'content', admin: { nav: { area: 'main' } } }, // no ui
      ],
    },
  })
  const specs = await readModuleUiSpecifiers(fakeLoad, 'virtual:latha/config')
  assert.deepEqual(specs, ['@latha/auth/admin'])
})

test('readModuleUiSpecifiers collects plugin admin.ui strings, de-duped against modules', async () => {
  const fakeLoad = async () => ({
    default: {
      modules: [{ name: 'media', admin: { ui: '@latha/media/admin' } }],
      plugins: [
        { name: 'slug', admin: { ui: '@latha/slug/admin' } },
        { name: 'slug2', admin: { ui: '@latha/media/admin' } }, // dup of a module's
        { name: 'bare' }, // no admin
      ],
    },
  })
  const specs = await readModuleUiSpecifiers(fakeLoad, 'virtual:latha/config')
  assert.deepEqual(specs, ['@latha/media/admin', '@latha/slug/admin'])
})

test('buildModuleSource imports each specifier and merges with the app glob', () => {
  const src = buildModuleSource('/src/admin', ['@latha/auth/admin'])
  assert.match(src, /from ["']@latha\/auth\/admin["']/)
  assert.match(src, /import\.meta\.glob\('\/src\/admin\/settings/)
  assert.match(src, /mergeExtensions/)
  assert.match(src, /collectAdminExtensions/)
  assert.match(src, /export const adminExtensions/)
  assert.match(src, /mergeExtensions\(\[mod0,\s*appExtensions\]\)/)
})

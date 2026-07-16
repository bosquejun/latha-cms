// packages/start/src/vite.studio-extensions.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readModuleUiSpecifiers, buildModuleSource, readStudioBranding } from './vite.js'

test('readModuleUiSpecifiers extracts and de-dupes module studio.ui strings', async () => {
  const fakeLoad = async () => ({
    default: {
      modules: [
        { name: 'users' },
        { name: 'auth', studio: { ui: '@kon10/auth/studio' } },
        { name: 'auth2', studio: { ui: '@kon10/auth/studio' } }, // dup
        { name: 'content', studio: { nav: { area: 'main' } } }, // no ui
      ],
    },
  })
  const specs = await readModuleUiSpecifiers(fakeLoad, 'virtual:kon10/config')
  assert.deepEqual(specs, ['@kon10/auth/studio'])
})

test('readModuleUiSpecifiers collects plugin studio.ui strings, de-duped against modules', async () => {
  const fakeLoad = async () => ({
    default: {
      modules: [{ name: 'media', studio: { ui: '@kon10/media/studio' } }],
      plugins: [
        { name: 'slug', studio: { ui: '@kon10/slug/studio' } },
        { name: 'slug2', studio: { ui: '@kon10/media/studio' } }, // dup of a module's
        { name: 'bare' }, // no studio
      ],
    },
  })
  const specs = await readModuleUiSpecifiers(fakeLoad, 'virtual:kon10/config')
  assert.deepEqual(specs, ['@kon10/media/studio', '@kon10/slug/studio'])
})

test('buildModuleSource imports each specifier and merges with the app glob', () => {
  const src = buildModuleSource('/src/studio', ['@kon10/auth/studio'])
  assert.match(src, /from ["']@kon10\/auth\/studio["']/)
  assert.match(src, /import\.meta\.glob\('\/src\/studio\/settings/)
  assert.match(src, /import\.meta\.glob\('\/src\/studio\/lists/)
  assert.match(src, /mergeExtensions/)
  assert.match(src, /collectStudioExtensions/)
  assert.match(src, /export const studioExtensions/)
  assert.match(src, /mergeExtensions\(\[mod0,\s*appExtensions\]\)/)
})

test('readStudioBranding returns the config studio.branding block', async () => {
  const fakeLoad = async () => ({
    default: {
      studio: {
        branding: { appName: 'Acme', logo: '/logo.svg', tagline: 'Ship it.' },
      },
    },
  })
  const branding = await readStudioBranding(fakeLoad, 'virtual:kon10/config')
  assert.deepEqual(branding, { appName: 'Acme', logo: '/logo.svg', tagline: 'Ship it.' })
})

test('readStudioBranding defaults to an empty object when unset', async () => {
  const fakeLoad = async () => ({ default: { modules: [] } })
  const branding = await readStudioBranding(fakeLoad, 'virtual:kon10/config')
  assert.deepEqual(branding, {})
})

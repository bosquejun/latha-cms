import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectStudioExtensions, mergeExtensions } from './collect.js'

const Comp = () => null

test('collectStudioExtensions assembles settings + fields from glob maps', () => {
  const ext = collectStudioExtensions({
    settings: {
      '/a/settings/roles.tsx': { default: Comp, config: { path: 'roles', label: 'Roles' } },
      '/a/settings/skip.tsx': { default: Comp }, // no config -> dropped
    },
    fields: {
      '/a/fields/rel.tsx': { default: Comp, config: { type: 'relationship' } },
    },
  })
  assert.equal(ext.settings?.length, 1)
  assert.equal(ext.settings?.at(0)?.path, 'roles')
  assert.equal(ext.settings?.at(0)?.id, '/a/settings/roles.tsx')
  assert.equal(ext.fields?.length, 1)
  assert.equal(ext.fields?.at(0)?.type, 'relationship')
  assert.equal(ext.fields?.at(0)?.renderer, Comp)
})

test('mergeExtensions lets later sources override by key', () => {
  const moduleExt = { settings: [{ path: 'roles', label: 'Module Roles', Component: Comp }] }
  const appExt = { settings: [{ path: 'roles', label: 'App Roles', Component: Comp }] }
  const merged = mergeExtensions([moduleExt, appExt])
  assert.equal(merged.settings?.length, 1)
  assert.equal(merged.settings?.at(0)?.label, 'App Roles') // app wins
})

test('mergeExtensions concatenates distinct keys', () => {
  const merged = mergeExtensions([
    { fields: [{ type: 'relationship', renderer: Comp }] },
    { fields: [{ type: 'richtext', renderer: Comp }] },
  ])
  assert.equal(merged.fields?.length, 2)
})

test('collectStudioExtensions assembles a list-view override from glob maps', () => {
  const ext = collectStudioExtensions({
    lists: {
      '/a/lists/media.tsx': { default: Comp, config: { slug: 'media' } },
      '/a/lists/skip.tsx': { default: Comp }, // no config -> dropped
    },
  })
  assert.equal(ext.lists?.length, 1)
  assert.equal(ext.lists?.at(0)?.slug, 'media')
  assert.equal(ext.lists?.at(0)?.Component, Comp)
})

test('mergeExtensions lets later sources override a list-view by slug', () => {
  const moduleExt = { lists: [{ slug: 'media', Component: Comp }] }
  const appExt = { lists: [{ slug: 'media', Component: Comp }] }
  const merged = mergeExtensions([moduleExt, appExt])
  assert.equal(merged.lists?.length, 1)
  assert.equal(merged.lists?.at(0)?.Component, appExt.lists[0]!.Component)
})

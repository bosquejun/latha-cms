import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectAdminExtensions, mergeExtensions } from './collect.js'

const Comp = () => null

test('collectAdminExtensions assembles settings + fields from glob maps', () => {
  const ext = collectAdminExtensions({
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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveSeo, type SeoHookTarget } from './hooks.js'

const target: SeoHookTarget = {
  fieldName: 'seo',
  from: { title: '{title}', description: '{excerpt}' },
  titleTemplate: '%s · Acme',
}

test('backfills blank sub-fields from sibling values, applying the title template', () => {
  const out = deriveSeo({ title: 'Hello', excerpt: 'A summary' }, target)
  assert.deepEqual(out.seo, { title: 'Hello · Acme', description: 'A summary' })
})

test('never overwrites values the editor already set (idempotent on update)', () => {
  const data = { title: 'Hello', excerpt: 'A summary', seo: { title: 'Custom', description: 'Mine' } }
  const once = deriveSeo(data, target)
  assert.deepEqual(once.seo, { title: 'Custom', description: 'Mine' })
  // Re-running changes nothing.
  const twice = deriveSeo(once, target)
  assert.deepEqual(twice.seo, once.seo)
})

test('title template applies only to a derived title, not a hand-written one', () => {
  const out = deriveSeo({ title: 'Hello', seo: { title: 'Typed' } }, target)
  assert.equal((out.seo as Record<string, unknown>).title, 'Typed')
})

test('leaves the payload untouched when nothing derives and no seo present', () => {
  const data = { other: 1 }
  const out = deriveSeo(data, target)
  assert.equal('seo' in out, false)
  assert.equal(out, data)
})

test('tolerates a null/garbage existing seo value', () => {
  assert.deepEqual(deriveSeo({ title: 'Hi', seo: null }, target).seo, { title: 'Hi · Acme' })
  assert.deepEqual(deriveSeo({ title: 'Hi', seo: 'bad' }, target).seo, { title: 'Hi · Acme' })
})

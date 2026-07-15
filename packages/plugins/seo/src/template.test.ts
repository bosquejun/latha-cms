import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyTitleTemplate, resolveTemplate, templateTokens } from './template.js'

test('templateTokens extracts unique field names in order', () => {
  assert.deepEqual(templateTokens('{title} — {category} ({title})'), ['title', 'category'])
  assert.deepEqual(templateTokens('no tokens here'), [])
})

test('resolveTemplate substitutes siblings and collapses whitespace', () => {
  assert.equal(resolveTemplate('{title}', { title: 'Hello' }), 'Hello')
  assert.equal(resolveTemplate('{a} — {b}', { a: 'X', b: 'Y' }), 'X — Y')
  // Nullish tokens render empty; the trimmed result is blank.
  assert.equal(resolveTemplate('{missing}', {}), '')
  assert.equal(resolveTemplate('{a}   {b}', { a: 'one', b: 'two' }), 'one two')
})

test('applyTitleTemplate wraps a title but never double-discards it', () => {
  assert.equal(applyTitleTemplate('Post', '%s · Acme'), 'Post · Acme')
  // No placeholder + a title → the title wins (template is not a suffix).
  assert.equal(applyTitleTemplate('Post', 'Acme'), 'Post')
  // No template → passthrough.
  assert.equal(applyTitleTemplate('Post'), 'Post')
})

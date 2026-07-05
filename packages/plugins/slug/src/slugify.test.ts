import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SLUG_PATH_PATTERN, formatDate, slugify, slugifyPath } from './slugify.js'

test('slugify kebab-cases and folds accents', () => {
  assert.equal(slugify('Hello World'), 'hello-world')
  assert.equal(slugify('Crème Brûlée!'), 'creme-brulee')
  assert.equal(slugify('  --Weird__punct...  '), 'weird-punct')
  assert.equal(slugify('Æon — über café'), 'aeon-uber-cafe')
})

test('slugify is idempotent on kebab input', () => {
  assert.equal(slugify('already-kebab-2'), 'already-kebab-2')
})

test('slugify folds non-NFKD-reducible scripts to empty', () => {
  assert.equal(slugify('こんにちは'), '')
})

test('slugifyPath slugifies per segment and drops empty segments', () => {
  assert.equal(slugifyPath('2026/07/Hello World'), '2026/07/hello-world')
  assert.equal(slugifyPath('/Blog//Épisode One/'), 'blog/episode-one')
  assert.equal(slugifyPath('//'), '')
})

test('SLUG_PATH_PATTERN accepts kebab paths and rejects junk', () => {
  assert.match('hello-world', SLUG_PATH_PATTERN)
  assert.match('2026/07/hello-world-2', SLUG_PATH_PATTERN)
  assert.doesNotMatch('Hello World', SLUG_PATH_PATTERN)
  assert.doesNotMatch('-leading', SLUG_PATH_PATTERN)
  assert.doesNotMatch('trailing/', SLUG_PATH_PATTERN)
  assert.doesNotMatch('double//slash', SLUG_PATH_PATTERN)
})

test('formatDate renders UTC tokens and empty for junk', () => {
  const d = new Date(Date.UTC(2026, 6, 4, 9, 5, 3))
  assert.equal(formatDate(d, 'yyyy/MM/dd'), '2026/07/04')
  assert.equal(formatDate('2026-07-04T09:05:03Z', 'yyyy-MM'), '2026-07')
  assert.equal(formatDate(d, 'HH:mm:ss'), '09:05:03')
  assert.equal(formatDate('not a date', 'yyyy'), '')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compileTokens,
  parseTemplate,
  resolveTokens,
  type TokenDb,
} from './template.js'

const postFields = [
  { name: 'title', type: 'text' },
  { name: 'publishedAt', type: 'date' },
  { name: 'category', type: 'taxonomy', to: 'categories' },
  { name: 'cover', type: 'media' },
  { name: 'views', type: 'number' },
]

test('parseTemplate treats a bare name as a single field token', () => {
  assert.deepEqual(parseTemplate('title'), [{ kind: 'field', name: 'title' }])
})

test('parseTemplate splits literals, fields, formats, and traversals', () => {
  assert.deepEqual(parseTemplate('blog/{publishedAt:yyyy/MM}/{category.slug}-{title}'), [
    { kind: 'literal', text: 'blog/' },
    { kind: 'field', name: 'publishedAt', format: 'yyyy/MM' },
    { kind: 'literal', text: '/' },
    { kind: 'rawref', name: 'category', path: 'slug', format: undefined },
    { kind: 'literal', text: '-' },
    { kind: 'field', name: 'title', format: undefined },
  ])
})

test('compileTokens resolves ref targets from the sibling field', () => {
  const tokens = compileTokens(parseTemplate('{category.slug}/{title}'), postFields, 'posts.slug')
  assert.deepEqual(tokens[0], { kind: 'ref', name: 'category', path: 'slug', via: 'categories', format: undefined })
  assert.deepEqual(tokens[2], { kind: 'field', name: 'title', format: undefined })
})

test('compileTokens targets media fields at the media entity', () => {
  const tokens = compileTokens(parseTemplate('{cover.filename}'), postFields, 'posts.slug')
  assert.deepEqual(tokens[0], { kind: 'ref', name: 'cover', path: 'filename', via: 'media', format: undefined })
})

test('compileTokens throws on unknown fields and non-reference traversals', () => {
  assert.throws(
    () => compileTokens(parseTemplate('{nope}'), postFields, 'posts.slug'),
    /unknown field "nope"/,
  )
  assert.throws(
    () => compileTokens(parseTemplate('{views.x}'), postFields, 'posts.slug'),
    /does not reference another entity/,
  )
})

function fakeDb(docs: Record<string, Record<string, unknown>>): TokenDb {
  return {
    async findOne(_collection, id) {
      return docs[id] ?? null
    },
  }
}

test('resolveTokens renders fields, formats dates, and looks up refs', async () => {
  const tokens = compileTokens(
    parseTemplate('{publishedAt:yyyy}/{category.slug}/{title}'),
    postFields,
    'posts.slug',
  )
  const raw = await resolveTokens(tokens, {
    data: { title: 'Hello World', publishedAt: '2026-07-04T00:00:00Z', category: 'cat-1' },
    db: fakeDb({ 'cat-1': { id: 'cat-1', slug: 'news' } }),
  })
  assert.equal(raw, '2026/news/Hello World')
})

test('resolveTokens drops missing refs and uses the first id of many-refs', async () => {
  const tokens = compileTokens(parseTemplate('{category.slug}/{title}'), postFields, 'posts.slug')
  const db = fakeDb({ 'cat-2': { id: 'cat-2', slug: 'tech' } })

  const missing = await resolveTokens(tokens, { data: { title: 'A Post' }, db })
  assert.equal(missing, '/A Post')

  const many = await resolveTokens(tokens, {
    data: { title: 'A Post', category: ['cat-2', 'cat-9'] },
    db,
  })
  assert.equal(many, 'tech/A Post')
})

test('resolveTokens falls back to previousDoc for absent payload keys', async () => {
  const tokens = compileTokens(parseTemplate('{title}'), postFields, 'posts.slug')
  const raw = await resolveTokens(tokens, {
    data: {},
    previousDoc: { title: 'Old Title' },
    db: fakeDb({}),
  })
  assert.equal(raw, 'Old Title')
})

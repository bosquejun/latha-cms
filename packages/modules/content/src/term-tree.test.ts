import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flattenTermTree, indentLabel, type Term } from './term-tree.js'

test('flat taxonomy yields depth-0 rows in input order', () => {
  const terms: Term[] = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
  ]
  assert.deepEqual(flattenTermTree(terms), [
    { id: 'a', name: 'Alpha', depth: 0 },
    { id: 'b', name: 'Beta', depth: 0 },
  ])
})

test('nested terms are ordered parent-then-children with increasing depth', () => {
  const terms: Term[] = [
    { id: 'eng', name: 'Engineering' },
    { id: 'fw', name: 'Frameworks', parent: 'eng' },
    { id: 'design', name: 'Design' },
  ]
  assert.deepEqual(flattenTermTree(terms), [
    { id: 'eng', name: 'Engineering', depth: 0 },
    { id: 'fw', name: 'Frameworks', depth: 1 },
    { id: 'design', name: 'Design', depth: 0 },
  ])
})

test('a parent pointer to an absent term is treated as a root', () => {
  const terms: Term[] = [{ id: 'x', name: 'X', parent: 'ghost' }]
  assert.deepEqual(flattenTermTree(terms), [{ id: 'x', name: 'X', depth: 0 }])
})

test('cyclic parents do not loop forever and nothing is dropped', () => {
  const terms: Term[] = [
    { id: 'a', name: 'A', parent: 'b' },
    { id: 'b', name: 'B', parent: 'a' },
  ]
  const out = flattenTermTree(terms)
  assert.equal(out.length, 2)
})

test('name falls back to id; indentLabel prefixes by depth', () => {
  assert.equal(indentLabel({ id: 'a', name: 'Alpha', depth: 0 }), 'Alpha')
  assert.equal(indentLabel({ id: 'a', name: 'Frameworks', depth: 2 }), '— — Frameworks')
  assert.deepEqual(flattenTermTree([{ id: 'noname' }]), [
    { id: 'noname', name: 'noname', depth: 0 },
  ])
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lexicalToPlainText } from './preview.js'

function doc(...paragraphs: string[]): string {
  return JSON.stringify({
    root: {
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        children: text ? [{ type: 'text', text }] : [],
      })),
    },
  })
}

test('flattens paragraphs into newline-separated text', () => {
  assert.equal(lexicalToPlainText(doc('Hello', 'World')), 'Hello\nWorld')
})

test('concatenates inline text nodes within a block', () => {
  const value = JSON.stringify({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'there' },
          ],
        },
      ],
    },
  })
  assert.equal(lexicalToPlainText(value), 'Hello there')
})

test('collapses blank blocks and trims surrounding whitespace', () => {
  assert.equal(lexicalToPlainText(doc('', 'Only line', '')), 'Only line')
})

test('returns empty string for empty, blank, or invalid input', () => {
  assert.equal(lexicalToPlainText(''), '')
  assert.equal(lexicalToPlainText('not json'), '')
  assert.equal(lexicalToPlainText('{}'), '')
  assert.equal(lexicalToPlainText(doc('', '')), '')
})

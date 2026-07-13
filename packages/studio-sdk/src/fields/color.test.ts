import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHADE_STEPS, shadesOf } from './color.js'

test('shadesOf returns a named 100-900 scale', () => {
  const shades = shadesOf('#3b82f6')

  assert.deepEqual(shades.map((shade) => shade.step), SHADE_STEPS)
  assert.equal(shades.length, 9)
  assert.equal(shades.filter((shade) => shade.isBase).length, 1)
  assert.equal(shades.find((shade) => shade.isBase)?.hex, '#3b82f6')
})

test('a dark brand color remains the exact 900 token', () => {
  const shades = shadesOf('#171717')
  const base = shades.find((shade) => shade.isBase)

  assert.deepEqual(base, { step: 900, hex: '#171717', isBase: true })
  assert.notEqual(shades[0]?.hex, shades[1]?.hex)
  assert.notEqual(shades[7]?.hex, shades[8]?.hex)
})

test('shadesOf ignores incomplete colors', () => {
  assert.deepEqual(shadesOf('#171'), [])
  assert.deepEqual(shadesOf(''), [])
})

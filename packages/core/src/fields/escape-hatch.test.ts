import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import './builtins.js'
import { buildZodSchema, kDataSchema, liveDataSchema } from './registry.js'
import { text, number, stampFields } from '../schema/fields.js'

test('schema escape hatch: live schema survives stampFields and drives validation', () => {
  const defs = {
    email: text({ schema: z.email(), required: true }),
    plain: text({ minLength: 2 }),
  }
  const fields = stampFields(defs)

  const emailField = fields.find((f) => f.name === 'email') as unknown as Record<string, unknown>
  assert.ok(liveDataSchema(emailField), 'symbol key survives the stampFields spread')

  const schema = buildZodSchema(fields as unknown as Array<Record<string, unknown>>)
  assert.equal(schema.safeParse({ email: 'a@b.co' }).success, true)
  assert.equal(schema.safeParse({ email: 'not-an-email' }).success, false)
  // literal-config path still works alongside
  assert.equal(schema.safeParse({ email: 'a@b.co', plain: 'x' }).success, false)
  assert.equal(schema.safeParse({ email: 'a@b.co', plain: 'xy' }).success, true)
})

test('schema escape hatch: live schema never reaches the JSON wire', () => {
  const fields = stampFields({
    price: number({ schema: z.number().positive().multipleOf(0.01), defaultValue: 1 }),
  })
  const wire = JSON.parse(JSON.stringify(fields)) as Array<Record<string, unknown>>
  assert.deepEqual(wire, [{ name: 'price', type: 'number', defaultValue: 1 }])
  // and the round-tripped config carries no symbol
  assert.equal(liveDataSchema(wire[0]!), undefined)
})

test('schema escape hatch: defaultValue and optionality still apply on top', () => {
  const fields = stampFields({
    score: number({ schema: z.number().int().min(0), defaultValue: 0 }),
    note: text({ schema: z.string().max(5) }),
  })
  const schema = buildZodSchema(fields as unknown as Array<Record<string, unknown>>)
  assert.deepEqual(schema.parse({}), { score: 0 })
  assert.equal(schema.safeParse({ score: -1 }).success, false)
  assert.equal(schema.safeParse({ note: 'toolong' }).success, false)
})

test('kDataSchema ignores non-Zod values', () => {
  const field: Record<string | symbol, unknown> = { name: 'x', type: 'text' }
  field[kDataSchema] = 'not a schema'
  assert.equal(liveDataSchema(field as Record<string, unknown>), undefined)
})

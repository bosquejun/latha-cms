import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AccessDeniedError, type GuardContext } from 'kon10'
import { createRbacGuard } from './guard.js'

const guard = createRbacGuard()

// `getEntity` returns an entity with no `access` predicate, so the guard falls
// through to the permission check (the publishable cap runs before this anyway).
const cms = { getEntity: () => ({ slug: 'posts' }) } as unknown as GuardContext['cms']

function ctx(overrides: Partial<GuardContext>): GuardContext {
  return {
    cms,
    operation: 'read',
    slug: 'posts',
    cardinality: 'many',
    principal: null,
    context: { enforce: true },
    ...overrides,
  } as GuardContext
}

test('publishable keys cannot write, even holding the write permission', () => {
  const principal = { publishable: true, permissions: ['posts:read', 'posts:update'] }
  assert.throws(() => guard(ctx({ principal, operation: 'update' })), AccessDeniedError)
  assert.throws(() => guard(ctx({ principal, operation: 'delete' })), AccessDeniedError)
})

test('publishable keys can read with the read permission', () => {
  const principal = { publishable: true, permissions: ['posts:read'] }
  assert.doesNotThrow(() => guard(ctx({ principal, operation: 'read' })))
})

test('secret keys can write with the permission (no cap)', () => {
  const principal = { publishable: false, permissions: ['posts:update'] }
  assert.doesNotThrow(() => guard(ctx({ principal, operation: 'update' })))
})

test('enforce=false short-circuits before the publishable cap', () => {
  const principal = { publishable: true, permissions: [] }
  assert.doesNotThrow(() =>
    guard(ctx({ principal, operation: 'update', context: { enforce: false } })),
  )
})

/**
 * Module-registry coverage: topological resolution, cycle/missing-dependency
 * detection, and duplicate module/entity guards.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ModuleRegistry } from './index.js'
import type { Module } from '../types/config.js'

const mod = (name: string, dependsOn?: string[], entitySlugs: string[] = []): Module => ({
  name,
  dependsOn,
  entities: entitySlugs.map((slug) => ({ cardinality: 'many', slug, fields: [] })),
})

test('resolve orders modules after their dependencies', () => {
  const registry = new ModuleRegistry()
  registry.registerAll([mod('content', ['auth', 'users']), mod('users', ['auth']), mod('auth')])
  const order = registry.resolve().map((m) => m.name)
  assert.ok(order.indexOf('auth') < order.indexOf('users'))
  assert.ok(order.indexOf('users') < order.indexOf('content'))
})

test('resolve reports cycles with the trail', () => {
  const registry = new ModuleRegistry()
  registry.registerAll([mod('a', ['b']), mod('b', ['a'])])
  assert.throws(() => registry.resolve(), /Circular module dependency.*a.*b/s)
})

test('resolve reports missing dependencies', () => {
  const registry = new ModuleRegistry()
  registry.register(mod('app', ['ghost']))
  assert.throws(() => registry.resolve(), /depends on "ghost", which is not registered/)
})

test('duplicate module names and entity slugs are rejected', () => {
  const registry = new ModuleRegistry()
  registry.register(mod('auth'))
  assert.throws(() => registry.register(mod('auth')), /Duplicate module/)

  const dupes = new ModuleRegistry()
  dupes.registerAll([mod('a', undefined, ['posts']), mod('b', undefined, ['posts'])])
  assert.throws(() => dupes.collectEntities(), /Duplicate entity slug "posts"/)
})

test('a colliding delivery-API prefix is rejected', () => {
  const registry = new ModuleRegistry()
  registry.register(mod('content'))
  // No explicit prefix on either module — 'blog' would default to its own
  // name, but here it's configured to collide with 'content'.
  assert.throws(
    () => registry.register({ ...mod('blog'), api: { prefix: 'content' } }),
    /"content" and "blog" both resolve to the delivery-API prefix "content"/,
  )
})

test('distinct explicit prefixes register fine, even reusing another module\'s name', () => {
  const registry = new ModuleRegistry()
  registry.register({ ...mod('content'), api: { prefix: 'articles' } })
  // 'content' the string is now free as a prefix even though it was the
  // other module's *name* — prefixes and names are only compared to each
  // other, not across the two namespaces.
  registry.register({ ...mod('blog'), api: { prefix: 'content' } })
  assert.equal(registry.get('content')?.name, 'content')
  assert.equal(registry.get('blog')?.name, 'blog')
})

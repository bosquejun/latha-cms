/**
 * Unit coverage for the pure permission logic: wildcard matching, principal
 * permission lookups, and the per-kind action sets.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  actionsForKind,
  hasPermission,
  matchesPermission,
  permissionKey,
} from './permissions.js'

test('matchesPermission: exact match', () => {
  assert.equal(matchesPermission('posts:update', 'posts:update'), true)
  assert.equal(matchesPermission('posts:update', 'posts:delete'), false)
  assert.equal(matchesPermission('posts:update', 'pages:update'), false)
})

test('matchesPermission: superadmin matches everything', () => {
  assert.equal(matchesPermission('*', 'posts:delete'), true)
  assert.equal(matchesPermission('*', 'admin:access'), true)
})

test('matchesPermission: scope and action wildcards', () => {
  assert.equal(matchesPermission('posts:*', 'posts:delete'), true)
  assert.equal(matchesPermission('posts:*', 'pages:delete'), false)
  assert.equal(matchesPermission('*:read', 'pages:read'), true)
  assert.equal(matchesPermission('*:read', 'pages:update'), false)
})

test('hasPermission: reads the principal permission set', () => {
  const viewer = { id: 'u1', permissions: ['admin:access', 'posts:read'] }
  assert.equal(hasPermission(viewer, 'posts:read'), true)
  assert.equal(hasPermission(viewer, 'posts:update'), false)
  assert.equal(hasPermission(viewer, 'admin:access'), true)
})

test('hasPermission: anonymous / malformed principals deny', () => {
  assert.equal(hasPermission(null, 'posts:read'), false)
  assert.equal(hasPermission({ id: 'u1' }, 'posts:read'), false)
  assert.equal(hasPermission('nope', 'posts:read'), false)
})

test('actionsForKind: per-kind grantable actions', () => {
  assert.deepEqual(actionsForKind('collection'), [
    'read',
    'create',
    'update',
    'delete',
  ])
  assert.deepEqual(actionsForKind('document'), ['read', 'update'])
  assert.deepEqual(actionsForKind('taxonomy'), ['read', 'create', 'delete'])
})

test('permissionKey composes scope:action', () => {
  assert.equal(permissionKey('posts', 'update'), 'posts:update')
  assert.equal(permissionKey('*', '*'), '*:*')
})

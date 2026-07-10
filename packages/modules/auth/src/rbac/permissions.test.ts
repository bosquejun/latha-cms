/**
 * Unit coverage for the pure permission logic: wildcard matching and principal
 * permission lookups.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
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
  assert.equal(matchesPermission('*', 'studio:access'), true)
})

test('matchesPermission: scope and action wildcards', () => {
  assert.equal(matchesPermission('posts:*', 'posts:delete'), true)
  assert.equal(matchesPermission('posts:*', 'pages:delete'), false)
  assert.equal(matchesPermission('*:read', 'pages:read'), true)
  assert.equal(matchesPermission('*:read', 'pages:update'), false)
})

test('hasPermission: reads the principal permission set', () => {
  const viewer = { id: 'u1', permissions: ['studio:access', 'posts:read'] }
  assert.equal(hasPermission(viewer, 'posts:read'), true)
  assert.equal(hasPermission(viewer, 'posts:update'), false)
  assert.equal(hasPermission(viewer, 'studio:access'), true)
})

test('hasPermission: anonymous / malformed principals deny', () => {
  assert.equal(hasPermission(null, 'posts:read'), false)
  assert.equal(hasPermission({ id: 'u1' }, 'posts:read'), false)
  assert.equal(hasPermission('nope', 'posts:read'), false)
})

test('permissionKey composes scope:action', () => {
  assert.equal(permissionKey('posts', 'update'), 'posts:update')
  assert.equal(permissionKey('*', '*'), '*:*')
})

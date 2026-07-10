/**
 * The RBAC guard — registered into the kernel's generic guard seam.
 *
 * It enforces permissions only when the caller opted in via `context.enforce`
 * (the Studio RPC layer sets it; the public local API does not — so headless
 * reads stay allow-by-default). When an entity declares its own explicit
 * `access` predicate for the operation, that predicate is authoritative and the
 * guard defers to it. Otherwise the guard is deny-by-default: the principal must
 * hold `"<slug>:<operation>"`.
 */

import { AccessDeniedError, type Guard } from '@kon10/core'
import { hasPermission, permissionKey } from './permissions.js'

export function createRbacGuard(): Guard {
  return (ctx) => {
    if (ctx.context.enforce !== true) return

    // An explicit per-entity access predicate already ran and authorized
    // this operation; don't second-guess it with the RBAC default.
    const entity = ctx.cms.getEntity(ctx.slug)
    const access =
      entity && 'access' in entity
        ? (entity as { access?: Record<string, unknown> }).access
        : undefined
    if (access?.[ctx.operation]) return

    const required = permissionKey(ctx.slug, ctx.operation)
    if (!hasPermission(ctx.principal, required)) {
      throw new AccessDeniedError(ctx.operation, ctx.slug)
    }
  }
}

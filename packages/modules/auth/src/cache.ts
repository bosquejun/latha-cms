/**
 * Cache keys + TTL policy for auth's principal/permission resolution.
 *
 * The read-through mechanism itself (`cached`/`invalidate`) lives in
 * `@kon10/cache` — fully generic, no knowledge of roles/users/api-keys.
 * Everything here is auth-specific: which key a given lookup uses, and how
 * long an entry survives if nothing invalidates it in the meantime.
 */

/**
 * Defense-in-depth only: role/api-key/user changes made through
 * `operations.*` invalidate immediately via entity hooks (see
 * `rbac/entities.ts`, `api-keys/entities.ts`, `module.ts`). This TTL only
 * matters for writes that bypass `operations.*` (seed scripts, a raw db
 * write, or a custom `subjectStore` @kon10/auth can't hook into).
 */
export const AUTH_CACHE_TTL_SECONDS = 30

export function roleIdKey(id: string): string {
  return `auth:role:id:${id}`
}

export function roleNameKey(name: string): string {
  return `auth:role:name:${name}`
}

export function apiKeyHashKey(hash: string): string {
  return `auth:apikey:${hash}`
}

export function userIdKey(slug: string, id: string): string {
  return `auth:user:${slug}:${id}`
}

/**
 * Server-only RPC dispatcher.
 *
 * The consuming app exposes ONE server function that forwards to
 * `handleLathaRequest`. This module imports `@tanstack/react-start/server`
 * (cookies), so it must only be reached via a dynamic `import()` inside a
 * server-function handler — never statically from client-reachable code.
 */

import { getCookie, setCookie } from '@tanstack/react-start/server'
import {
  operations,
  type Entity,
  type Field,
  type LathaInstance,
  type Module,
  type ResolvedConfig,
} from '@latha/core'
import { createContentApi } from '@latha/content'
import {
  authenticate,
  createSessionToken,
  getUserById,
  getPublicPrincipal,
  verifySessionToken,
  hasPermission,
  ADMIN_ACCESS,
  type AuthUser,
  type AuthOptions,
  DEFAULT_COOKIE_NAME,
  DEFAULT_SESSION_TTL_SECONDS,
} from '@latha/auth'
import { AccessDeniedError } from '@latha/core'
import type { JsonValue } from '@latha/core'
import { getRuntime } from './runtime.js'
import type {
  EntityDescriptor,
  LathaRpcInput,
  NavItem,
  NavSection,
  SessionUser,
} from '@latha/admin-sdk'

// Avoid a hard @types/node dependency for one env var.
declare const process: { env: Record<string, string | undefined> }

/** Dev fallback — set `AUTH_SECRET` in production. */
export const DEV_SECRET = 'latha-dev-secret-change-me'

function authOptions(): AuthOptions {
  return {
    secret: process.env.AUTH_SECRET ?? DEV_SECRET,
    cookieName: DEFAULT_COOKIE_NAME,
    sessionTtlSeconds: DEFAULT_SESSION_TTL_SECONDS,
  }
}

function humanize(input: string): string {
  const spaced = input.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function fieldsOf(entity: Entity): Field[] {
  return entity.kind === 'taxonomy' ? (entity.fields ?? []) : entity.fields
}

function labelOf(entity: Entity): string {
  const labels = entity.admin?.labels
  if (entity.kind === 'document') return labels?.singular ?? humanize(entity.slug)
  return labels?.plural ?? humanize(entity.slug)
}

const SEGMENT = {
  collection: 'content',
  document: 'documents',
  taxonomy: 'taxonomy',
} as const

/**
 * Whether `principal` may read `entity` (drives nav visibility). Mirrors the
 * RBAC guard: an explicit `access.read` predicate is authoritative; otherwise
 * fall back to the `<slug>:read` permission.
 */
async function canReadEntity(
  entity: Entity,
  principal: unknown,
): Promise<boolean> {
  const access =
    'access' in entity
      ? (entity as { access?: { read?: (ctx: unknown) => unknown } }).access
      : undefined
  if (access?.read) {
    try {
      return Boolean(await access.read({ principal, operation: 'read' }))
    } catch {
      return false
    }
  }
  return hasPermission(principal, `${entity.slug}:read`)
}

/** Build the sidebar sections: entities grouped by their module's nav section. */
async function navOf(
  latha: LathaInstance,
  basePath: string,
  principal: unknown,
): Promise<NavSection[]> {
  // Map each entity slug to its contributing module (for default nav grouping).
  const moduleOf = new Map<string, Module>()
  for (const module of latha.modules) {
    for (const entity of module.entities ?? []) moduleOf.set(entity.slug, module)
  }

  interface SectionAcc extends NavSection {}
  const sections = new Map<string, SectionAcc>()

  for (const entity of latha.entities) {
    if (entity.admin?.hidden) continue
    if (!(await canReadEntity(entity, principal))) continue
    const module = moduleOf.get(entity.slug)
    const navMeta = module?.admin?.nav
    // No declared group → ungrouped (empty label): the client renders it as a
    // flat, label-less list at the top rather than a one-item heading.
    const label = entity.admin?.group ?? navMeta?.label ?? ''
    const order = navMeta?.order ?? (label === '' ? -100 : 0)
    // `settings`-area entities live behind the Settings button and route under
    // `/admin/settings/…` so the shell knows to show the settings sidebar.
    const area = entity.admin?.area ?? navMeta?.area ?? 'main'
    const routeBase = area === 'settings' ? `${basePath}/settings` : basePath
    // Keep main and settings sections distinct even if they share a label.
    const sectionKey = `${area} ${label}`

    const item: NavItem = {
      slug: entity.slug,
      kind: entity.kind,
      label: labelOf(entity),
      href: `${routeBase}/${SEGMENT[entity.kind]}/${entity.slug}`,
      order: entity.admin?.order,
    }

    let section = sections.get(sectionKey)
    if (!section) {
      section = {
        key: sectionKey,
        area,
        label,
        order,
        collapsible: navMeta?.collapsible,
        defaultCollapsed: navMeta?.defaultCollapsed,
        items: [],
      }
      sections.set(sectionKey, section)
    } else {
      // A group spanning modules takes the earliest order and any collapsible.
      section.order = Math.min(section.order, order)
      section.collapsible = section.collapsible || navMeta?.collapsible
    }
    section.items.push(item)
  }

  const out = [...sections.values()]
  out.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  for (const section of out) {
    section.items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  return out
}

function describe(entity: Entity): EntityDescriptor {
  const base: EntityDescriptor = {
    slug: entity.slug,
    kind: entity.kind,
    label: labelOf(entity),
    fields: fieldsOf(entity) as unknown as EntityDescriptor['fields'],
  }
  if (entity.kind === 'collection') {
    base.useAsTitle = entity.admin?.useAsTitle
    base.defaultColumns = entity.admin?.defaultColumns
  }
  return base
}

function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    roles: user.roles ?? [],
    permissions: user.permissions ?? [],
  }
}

async function currentAuthUser(latha: LathaInstance): Promise<AuthUser | null> {
  const opts = authOptions()
  const token = getCookie(opts.cookieName ?? DEFAULT_COOKIE_NAME)
  if (!token) return null
  const payload = await verifySessionToken(token, opts.secret)
  if (!payload) return null
  return getUserById(latha, payload.sub)
}

/**
 * Dispatch one RPC request and coerce the result to a JSON-serializable value.
 *
 * This is the default handler body for the app's single server function. Import
 * it lazily inside the handler (`await import('@latha/start/server')`) so this
 * module's server-only imports never reach the client bundle.
 */
export async function dispatchLathaRpc(
  config: ResolvedConfig,
  input: LathaRpcInput,
): Promise<JsonValue> {
  return (await handleLathaRequest(config, input)) as JsonValue
}

/** Actions available without an authenticated admin session. */
const PUBLIC_ACTIONS = new Set<LathaRpcInput['action']>([
  'currentUser',
  'login',
  'logout',
])

/** Dispatch a single RPC request against the running instance. */
export async function handleLathaRequest(
  config: ResolvedConfig,
  input: LathaRpcInput,
): Promise<unknown> {
  const latha = await getRuntime(config)
  const basePath = config.adminPath || '/admin'

  // The actual logged-in user (drives `currentUser` + login redirect), and the
  // effective principal for enforcement: the user, or the synthetic Public
  // principal for anonymous requests. Public never holds `admin:access`, so the
  // admin gate below still blocks anonymous callers.
  const sessionUser = await currentAuthUser(latha)
  const principal: AuthUser | Awaited<ReturnType<typeof getPublicPrincipal>> =
    sessionUser ?? (await getPublicPrincipal(latha))

  // Top-level gate: every action except login/logout/currentUser requires a
  // principal that can access the admin surface.
  if (!PUBLIC_ACTIONS.has(input.action) && !hasPermission(principal, ADMIN_ACCESS)) {
    throw new AccessDeniedError('read', 'admin')
  }

  const api = createContentApi({
    getLatha: () => Promise.resolve(latha),
    getPrincipal: () => Promise.resolve(principal),
    enforce: true,
  })

  switch (input.action) {
    case 'nav':
      return navOf(latha, basePath, principal)
    case 'entity': {
      const entity = latha.getEntity(input.slug)
      return entity ? describe(entity) : null
    }
    case 'list':
      return api.list(input.collection)
    case 'get':
      return api.findOne(input.collection, input.id)
    case 'create':
      return api.create(input.collection, input.data)
    case 'update':
      return api.update(input.collection, input.id, input.data)
    case 'remove':
      await api.remove(input.collection, input.id)
      return { id: input.id }
    case 'getGlobal':
      return api.getGlobal(input.slug)
    case 'saveGlobal':
      return api.saveGlobal(input.slug, input.data)

    case 'currentUser':
      return sessionUser ? toSessionUser(sessionUser) : null
    case 'login': {
      const opts = authOptions()
      const user = await authenticate(latha, input.email, input.password)
      if (!user) return { ok: false, user: null }
      const token = await createSessionToken(
        { sub: user.id },
        opts.secret,
        opts.sessionTtlSeconds,
      )
      setCookie(opts.cookieName ?? DEFAULT_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: opts.sessionTtlSeconds,
      })
      return { ok: true, user: toSessionUser(user) }
    }
    case 'logout': {
      const opts = authOptions()
      setCookie(opts.cookieName ?? DEFAULT_COOKIE_NAME, '', {
        httpOnly: true,
        path: '/',
        maxAge: 0,
      })
      return { ok: true }
    }
  }
}

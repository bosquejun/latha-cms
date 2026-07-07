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
  evaluateAccess,
  liveDataSchema,
  z,
  type Entity,
  type EntityAccess,
  type LathaInstance,
  type Module,
  type OperationContext,
  type ResolvedConfig,
} from '@latha/core'
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
import { clearLoginFailures, loginBlocked, recordLoginFailure } from './login-throttle.js'
import { humanize, LathaRpcInputSchema } from '@latha/admin-sdk'
import type {
  EntityDescriptor,
  LathaRpcInput,
  NavItem,
  NavSection,
  SessionUser,
} from '@latha/admin-sdk'

// Avoid a hard @types/node dependency for one env var.
declare const process: { env: Record<string, string | undefined> }

/** Force a value to its JSON-serializable form via a structural round-trip. */
function toJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** Dev fallback — set `AUTH_SECRET` in production. */
export const DEV_SECRET = 'latha-dev-secret-change-me'

/**
 * CSRF guard for the cookie-authenticated endpoints (RPC + upload): a browser
 * always sends `Origin` on cross-origin POSTs, so an Origin whose host differs
 * from the request host is rejected. Requests without an Origin header
 * (curl, server-to-server) pass — they don't carry ambient cookies. Hosts are
 * compared (not full origins) so a TLS-terminating proxy doesn't false-flag
 * the scheme.
 */
export function rejectUntrustedOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin')
  if (!origin) return null
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return Response.json({ error: 'Invalid Origin header.' }, { status: 403 })
  }
  const requestHost = request.headers.get('x-forwarded-host') ?? new URL(request.url).host
  if (originHost !== requestHost) {
    return Response.json(
      { error: 'Cross-origin requests to this endpoint are not allowed.' },
      { status: 403 },
    )
  }
  return null
}

function authOptions(): AuthOptions {
  const secret = process.env['AUTH_SECRET']
  if (!secret && process.env['NODE_ENV'] === 'production') {
    throw new Error('[latha] AUTH_SECRET environment variable is required in production.')
  }
  return {
    secret: secret ?? DEV_SECRET,
    cookieName: DEFAULT_COOKIE_NAME,
    sessionTtlSeconds: DEFAULT_SESSION_TTL_SECONDS,
  }
}

function labelOf(entity: Entity): string {
  const labels = entity.admin?.labels
  if (entity.cardinality === 'single') return labels?.singular ?? humanize(entity.slug)
  return labels?.plural ?? humanize(entity.slug)
}

/**
 * Whether `principal` may read `entity` (drives nav visibility). Mirrors the
 * RBAC guard: an explicit `access.read` predicate is authoritative; otherwise
 * fall back to the `<slug>:read` permission.
 */
async function canReadEntity(
  entity: Entity,
  principal: unknown,
): Promise<boolean> {
  const access = (entity as { access?: EntityAccess }).access
  if (access?.read) {
    try {
      return await evaluateAccess(access, { principal, operation: 'read' })
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

    // `segment` is stamped by the contributing module (e.g. `Collection()` →
    // 'content', `Taxonomy()` → 'taxonomy', `Document()` → 'documents').
    // Fall back to a cardinality-derived default for raw entity literals that
    // don't set it.
    const segment = entity.admin?.segment ?? (entity.cardinality === 'single' ? 'documents' : 'content')
    const item: NavItem = {
      slug: entity.slug,
      kind: entity.kind ?? (entity.cardinality === 'single' ? 'document' : 'collection'),
      cardinality: entity.cardinality,
      label: labelOf(entity),
      href: `${routeBase}/${segment}/${entity.slug}`,
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

/**
 * Fields carrying a live Zod schema (the builders' `schema` escape hatch) get
 * a `jsonSchema` companion on the wire via `z.toJSONSchema` — the client
 * reads it for form hints and pre-validation. The live schema itself sits
 * under a symbol key, which `JSON.stringify` drops, so it never leaves the
 * server; constraints JSON Schema can't express degrade to server-only
 * validation (`unrepresentable: 'any'`).
 */
function describeFields(fields: Entity['fields']): Entity['fields'] {
  return fields.map((field) => {
    const live = liveDataSchema(field as unknown as Record<string, unknown>)
    if (!live) return field
    return { ...field, jsonSchema: z.toJSONSchema(live, { unrepresentable: 'any' }) }
  }) as Entity['fields']
}

function describe(entity: Entity): EntityDescriptor {
  return {
    slug: entity.slug,
    kind: entity.kind ?? (entity.cardinality === 'single' ? 'document' : 'collection'),
    label: labelOf(entity),
    fields: describeFields(entity.fields) as unknown as EntityDescriptor['fields'],
    useAsTitle: entity.admin?.useAsTitle,
    defaultColumns: entity.admin?.defaultColumns,
  }
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

type PublicPrincipal = Awaited<ReturnType<typeof getPublicPrincipal>>

/**
 * The synthetic anonymous principal. Resolved fresh per request — like user
 * grants — so edits to the Public role in the matrix UI apply immediately
 * instead of waiting for a server restart.
 */
export async function resolveAnonymousPrincipal(latha: LathaInstance): Promise<PublicPrincipal> {
  return getPublicPrincipal(latha)
}

/**
 * Resolve the caller for an incoming request: the actual logged-in user (for
 * `currentUser` / login redirects) and the effective principal for
 * enforcement — the user, or the synthetic Public principal for anonymous
 * requests. Public never holds `admin:access`, so callers still get blocked
 * by an admin gate downstream. Shared by the RPC dispatcher and the upload
 * dispatcher so both transports authenticate identically.
 */
export async function resolvePrincipal(
  latha: LathaInstance,
): Promise<{ sessionUser: AuthUser | null; principal: AuthUser | PublicPrincipal }> {
  const sessionUser = await currentAuthUser(latha)
  const principal: AuthUser | PublicPrincipal =
    sessionUser ?? (await resolveAnonymousPrincipal(latha))
  return { sessionUser, principal }
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
  rawInput: unknown,
): Promise<JsonValue> {
  return (await handleLathaRequest(config, rawInput)) as JsonValue
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
  rawInput: unknown,
): Promise<unknown> {
  const parseResult = LathaRpcInputSchema.safeParse(rawInput)
  if (!parseResult.success) {
    throw new Error(`Invalid RPC input: ${parseResult.error.message}`)
  }
  const input = parseResult.data
  const latha = await getRuntime(config)
  const basePath = config.adminPath || '/admin'

  const { sessionUser, principal } = await resolvePrincipal(latha)

  // Top-level gate: every action except login/logout/currentUser requires a
  // principal that can access the admin surface.
  if (!PUBLIC_ACTIONS.has(input.action) && !hasPermission(principal, ADMIN_ACCESS)) {
    throw new AccessDeniedError('read', 'admin')
  }

  const opCtx: OperationContext = { cms: latha, principal, context: { enforce: true } }

  switch (input.action) {
    case 'nav':
      return navOf(latha, basePath, principal)
    case 'entity': {
      const entity = latha.getEntity(input.slug)
      return entity ? describe(entity) : null
    }
    case 'list':
      return (await operations.find(opCtx, input.slug)).map(toJson)
    case 'page': {
      const limit = input.limit ?? 50
      const offset = input.offset ?? 0
      const query = { limit, offset, sort: input.sort }
      const [docs, total] = await Promise.all([
        operations.find(opCtx, input.slug, query),
        operations.count(opCtx, input.slug),
      ])
      return { docs: docs.map(toJson), total, limit, offset }
    }
    case 'get': {
      const doc = await operations.findOne(opCtx, input.slug, input.id)
      return doc ? toJson(doc) : null
    }
    case 'create':
      return toJson(await operations.create(opCtx, input.slug, input.data))
    case 'update':
      return toJson(await operations.update(opCtx, input.slug, input.id, input.data))
    case 'remove':
      await operations.destroy(opCtx, input.slug, input.id)
      return { id: input.id }
    case 'getGlobal': {
      const doc = await operations.findGlobal(opCtx, input.slug)
      return doc ? toJson(doc) : null
    }
    case 'saveGlobal':
      return toJson(await operations.saveGlobal(opCtx, input.slug, input.data))

    case 'currentUser':
      return sessionUser ? toSessionUser(sessionUser) : null
    case 'login': {
      const opts = authOptions()
      if (loginBlocked(input.email)) {
        return {
          ok: false,
          user: null,
          error: 'Too many failed attempts. Try again in a few minutes.',
        }
      }
      const user = await authenticate(latha, input.email, input.password)
      if (!user) {
        recordLoginFailure(input.email)
        return { ok: false, user: null }
      }
      clearLoginFailures(input.email)
      const token = await createSessionToken(
        { sub: user.id },
        opts.secret,
        opts.sessionTtlSeconds,
      )
      setCookie(opts.cookieName ?? DEFAULT_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] !== 'development',
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
        secure: process.env['NODE_ENV'] !== 'development',
        path: '/',
        maxAge: 0,
      })
      return { ok: true }
    }
  }
}

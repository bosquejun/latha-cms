/**
 * Server-only RPC dispatcher.
 *
 * The consuming app exposes ONE server function that forwards to
 * `handleKon10Request`. Session/cookie handling lives entirely in
 * `@kon10/auth` (`getSessionUser` reads the `Cookie` header straight off the
 * `Request` — no framework-specific cookie API); this module just carries the
 * `Request` through. It's still server-only business logic, so it must only
 * be reached via a dynamic `import()` inside a server-function handler —
 * never statically from client-reachable code.
 */

import {
  operations,
  evaluateAccess,
  liveDataSchema,
  z,
  type Entity,
  type EntityAccess,
  type Kon10Instance,
  type Module,
  type OperationContext,
  type ResolvedConfig,
} from '@kon10/core'
import {
  getSessionUser,
  getPublicPrincipal,
  resolveAuthOptions,
  hasPermission,
  STUDIO_ACCESS,
  type AuthUser,
} from '@kon10/auth'
import { AccessDeniedError } from '@kon10/core'
import type { JsonValue } from '@kon10/core'
import { getRuntime } from './runtime.js'
import { humanize, Kon10RpcInputSchema } from '@kon10/studio-sdk'
import type { EntityDescriptor, NavItem, NavSection } from '@kon10/studio-sdk'
import { hiddenFieldNames, projectDoc } from './hidden-fields.js'

/** Force a value to its JSON-serializable form via a structural round-trip. */
function toJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/**
 * CSRF guard for the cookie-authenticated endpoints (RPC + module routes): a
 * browser always sends `Origin` on cross-origin POSTs, so an Origin whose host differs
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

function labelOf(entity: Entity): string {
  const labels = entity.studio?.labels
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

/** Build the nav sections: entities grouped by their module's nav section. */
async function navOf(
  kon10: Kon10Instance,
  basePath: string,
  principal: unknown,
): Promise<NavSection[]> {
  // Map each entity slug to its contributing module (for default nav grouping).
  const moduleOf = new Map<string, Module>()
  for (const module of kon10.modules) {
    for (const entity of module.entities ?? []) moduleOf.set(entity.slug, module)
  }

  interface SectionAcc extends NavSection {}
  const sections = new Map<string, SectionAcc>()

  for (const entity of kon10.entities) {
    if (entity.studio?.hidden) continue
    if (!(await canReadEntity(entity, principal))) continue
    const module = moduleOf.get(entity.slug)
    const navMeta = module?.studio?.nav
    // No declared group → ungrouped (empty label): the client renders it as a
    // flat, label-less list at the top rather than a one-item heading.
    const label = entity.studio?.group ?? navMeta?.label ?? ''
    const order = navMeta?.order ?? (label === '' ? -100 : 0)
    // `settings`-area entities live under the Settings tab and route under
    // `/studio/settings/…` so the shell lists them in its section rail.
    const area = entity.studio?.area ?? navMeta?.area ?? 'main'
    const routeBase = area === 'settings' ? `${basePath}/settings` : basePath
    // Keep main and settings sections distinct even if they share a label.
    const sectionKey = `${area} ${label}`

    // `segment` is stamped by the contributing module (e.g. `Collection()` →
    // 'content', `Taxonomy()` → 'taxonomy', `Document()` → 'documents').
    // Fall back to a cardinality-derived default for raw entity literals that
    // don't set it.
    const segment = entity.studio?.segment ?? (entity.cardinality === 'single' ? 'documents' : 'content')
    const item: NavItem = {
      slug: entity.slug,
      kind: entity.kind ?? (entity.cardinality === 'single' ? 'document' : 'collection'),
      cardinality: entity.cardinality,
      label: labelOf(entity),
      href: `${routeBase}/${segment}/${entity.slug}`,
      order: entity.studio?.order,
      contentWidth: entity.studio?.contentWidth ?? module?.studio?.contentWidth,
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
      section.defaultCollapsed = section.defaultCollapsed || navMeta?.defaultCollapsed
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

/** The module that contributed `slug`'s entity (for module-level studio defaults). */
function moduleFor(kon10: Kon10Instance, slug: string): Module | undefined {
  return kon10.modules.find((module) => module.entities?.some((entity) => entity.slug === slug))
}

function describe(entity: Entity, module?: Module): EntityDescriptor {
  return {
    slug: entity.slug,
    kind: entity.kind ?? (entity.cardinality === 'single' ? 'document' : 'collection'),
    label: labelOf(entity),
    fields: describeFields(entity.fields) as unknown as EntityDescriptor['fields'],
    useAsTitle: entity.studio?.useAsTitle,
    defaultColumns: entity.studio?.defaultColumns,
    formWidth: entity.studio?.formWidth,
    // Same resolution as `navOf`: entity override, else module default.
    contentWidth: entity.studio?.contentWidth ?? module?.studio?.contentWidth,
  }
}

type PublicPrincipal = Awaited<ReturnType<typeof getPublicPrincipal>>

/**
 * The synthetic anonymous principal. Resolved fresh per request — like user
 * grants — so edits to the Public role in the matrix UI apply immediately
 * instead of waiting for a server restart.
 */
export async function resolveAnonymousPrincipal(kon10: Kon10Instance): Promise<PublicPrincipal> {
  return getPublicPrincipal(kon10)
}

/**
 * Resolve the caller for an incoming request: the actual logged-in user (if
 * any) and the effective principal for enforcement — the user, or the
 * synthetic Public principal for anonymous requests. Public never holds
 * `studio:access`, so callers still get blocked by a Studio gate downstream.
 * Shared by the RPC dispatcher and the generic module-route dispatcher so
 * every transport authenticates identically.
 *
 * Session resolution itself (`getSessionUser`) is `@kon10/auth`'s: it reads
 * the `Cookie` header directly off `request`, so this runner never touches a
 * framework-specific cookie API.
 */
export async function resolvePrincipal(
  kon10: Kon10Instance,
  request: Request,
): Promise<{ sessionUser: AuthUser | null; principal: AuthUser | PublicPrincipal }> {
  const sessionUser = await getSessionUser(request, resolveAuthOptions(), kon10)
  const principal: AuthUser | PublicPrincipal =
    sessionUser ?? (await resolveAnonymousPrincipal(kon10))
  return { sessionUser, principal }
}

/**
 * Dispatch one RPC request and coerce the result to a JSON-serializable value.
 *
 * This is the default handler body for the app's single server function. Import
 * it lazily inside the handler (`await import('@kon10/start/server')`) so this
 * module's server-only imports never reach the client bundle. `request` is
 * needed for session resolution (`resolvePrincipal`) — a hand-written
 * `createServerFn` wiring its own call to this must supply it (e.g. via
 * `getRequest()` from `@tanstack/react-start/server`).
 */
export async function dispatchKon10Rpc(
  config: ResolvedConfig,
  rawInput: unknown,
  request: Request,
): Promise<JsonValue> {
  return (await handleKon10Request(config, rawInput, request)) as JsonValue
}

/** Dispatch a single RPC request against the running instance. */
export async function handleKon10Request(
  config: ResolvedConfig,
  rawInput: unknown,
  request: Request,
): Promise<unknown> {
  const parseResult = Kon10RpcInputSchema.safeParse(rawInput)
  if (!parseResult.success) {
    throw new Error(`Invalid RPC input: ${parseResult.error.message}`)
  }
  const input = parseResult.data
  const kon10 = await getRuntime(config)
  const basePath = config.studioPath || '/studio'

  const { principal } = await resolvePrincipal(kon10, request)

  // Every remaining action is Studio-only. Login/logout/currentUser run
  // without a session by definition (they live under @kon10/auth's own
  // routes, see `ModuleRoute`), so they can't sit behind this gate.
  if (!hasPermission(principal, STUDIO_ACCESS)) {
    throw new AccessDeniedError('read', 'studio')
  }

  const opCtx: OperationContext = { cms: kon10, principal, context: { enforce: true } }

  // `meta.hidden` fields (credential material like `passwordHash`/`keyHash`)
  // must never reach the browser — not even here, where the Studio form just
  // omits them from rendering. Mirrors the delivery API's `projectDoc`.
  const project = (slug: string, doc: Record<string, unknown>) => {
    const entity = kon10.getEntity(slug)
    const hidden = entity ? hiddenFieldNames(entity) : new Set<string>()
    return projectDoc(hidden, toJson(doc))
  }

  switch (input.action) {
    case 'nav':
      return navOf(kon10, basePath, principal)
    case 'entity': {
      const entity = kon10.getEntity(input.slug)
      return entity ? describe(entity, moduleFor(kon10, entity.slug)) : null
    }
    case 'list':
      return (await operations.find(opCtx, input.slug)).map((doc) => project(input.slug, doc))
    case 'page': {
      const limit = input.limit ?? 50
      const offset = input.offset ?? 0
      const query = { limit, offset, sort: input.sort }
      const [docs, total] = await Promise.all([
        operations.find(opCtx, input.slug, query),
        operations.count(opCtx, input.slug),
      ])
      return { docs: docs.map((doc) => project(input.slug, doc)), total, limit, offset }
    }
    case 'get': {
      const doc = await operations.findOne(opCtx, input.slug, input.id)
      return doc ? project(input.slug, doc) : null
    }
    case 'create':
      return project(input.slug, await operations.create(opCtx, input.slug, input.data))
    case 'update':
      return project(input.slug, await operations.update(opCtx, input.slug, input.id, input.data))
    case 'remove':
      await operations.destroy(opCtx, input.slug, input.id)
      return { id: input.id }
    case 'getGlobal': {
      const doc = await operations.findGlobal(opCtx, input.slug)
      return doc ? project(input.slug, doc) : null
    }
    case 'saveGlobal':
      return project(input.slug, await operations.saveGlobal(opCtx, input.slug, input.data))
  }
}

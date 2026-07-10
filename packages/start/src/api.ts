/**
 * Public content delivery API — the headless read surface.
 *
 * Every entity is addressed through the delivery-API prefix of the module
 * that contributes it (`Module.api.prefix`, defaulting to the module's own
 * `name`) — not by a flat, module-agnostic slug:
 *
 *   GET <api>/<prefix>/<slug>           → paginated list of documents
 *   GET <api>/<prefix>/<slug>/:id       → one document (404 when absent)
 *   GET <api>/<prefix>/<slug> (single)  → the singleton document
 *
 * Every response — success or failure, single resource or list — is the same
 * envelope (see `./envelope.ts`): `{ data, error, pagination? }`. `error` is
 * `null` on success; `data` is `null` on failure. `data` is the entity's own
 * shape for a single resource, or an array of it for a list; `pagination`
 * only appears on list responses.
 *
 * A module contributing exactly one entity may address it directly under its
 * own prefix, without a redundant slug segment — `@kon10/media`'s single
 * `media` entity is `<api>/media` and `<api>/media/:id`, not
 * `<api>/media/media/:id`. Modules with more than one entity always need the
 * slug segment to disambiguate (`<api>/contents/posts`, `<api>/contents/pages`).
 *
 * Query params on lists: `page` (1-indexed, default 1), `pageSize` (default
 * 50, max 200), `sort` (`-createdAt,name`), and equality filters
 * `where[field]=value`.
 *
 * Anonymous requests run as the Public role; `Authorization: Bearer kon10_…`
 * runs as the API key's roles. Enforcement is always on — the RBAC guard
 * requires `<slug>:read` — so nothing is exposed until an admin grants the
 * Public role a read or issues a key. Fields marked `meta.hidden` (credential
 * material like `passwordHash`/`keyHash`) never leave this surface.
 *
 * Server-only: reached via dynamic `import()` from the route handler, exactly
 * like the RPC dispatcher.
 */

import { createHash } from 'node:crypto'
import {
  AccessDeniedError,
  moduleApiPrefix,
  operations,
  type Entity,
  type JsonValue,
  type Kon10Instance,
  type Query,
  type QuerySort,
  type ResolvedConfig,
} from '@kon10/core'
import { verifyApiKeyToken, API_KEY_TOKEN_PREFIX } from '@kon10/auth'
import { DEFAULT_API_PATH } from '@kon10/studio-sdk'
import { getRuntime } from './runtime.js'
import { resolveAnonymousPrincipal } from './server.js'
import { hiddenFieldNames, projectDoc } from './hidden-fields.js'
import { API_ERROR_CODES, apiFailure, apiPaginationOf, apiSuccess, type ApiResponse } from './envelope.js'

const LIST_DEFAULT_PAGE_SIZE = 50
const LIST_MAX_PAGE_SIZE = 200
const DEFAULT_CACHE_TTL_SECONDS = 60

interface CorsSettings {
  cors: '*' | string[] | false
}

function corsSettings(config: ResolvedConfig): CorsSettings {
  return { cors: config.api?.cors ?? '*' }
}

/** CORS headers for one response, honoring the configured origin policy. */
function corsHeaders(settings: CorsSettings, origin: string | null): Record<string, string> {
  if (settings.cors === false) return {}
  if (settings.cors === '*') return { 'access-control-allow-origin': '*' }
  if (origin && settings.cors.includes(origin)) {
    return { 'access-control-allow-origin': origin, vary: 'Origin' }
  }
  return { vary: 'Origin' }
}

function json(
  status: number,
  body: ApiResponse<unknown>,
  extraHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

/**
 * Cache key for one delivery-API read, scoped per-caller-identity so a
 * cached response for one API key (or anonymous) is never served to
 * another. The raw `Authorization` header is hashed, never stored — the
 * cache backend must not hold bearer tokens verbatim.
 */
function deliveryCacheKey(request: Request, url: URL): string {
  const auth = request.headers.get('authorization') ?? 'anon'
  const identity = createHash('sha256').update(auth).digest('hex')
  return `delivery:${identity}:${url.pathname}${url.search}`
}

/** Field names valid in `sort` / `where` params (declared fields + implicits). */
function queryableFields(entity: Entity): Set<string> {
  const names = new Set(['id', 'createdAt', 'updatedAt'])
  for (const field of entity.fields) names.add((field as { name: string }).name)
  return names
}

class BadRequestError extends Error {}

/** Parse `sort=-createdAt,name` against the entity's field set. */
function parseSort(entity: Entity, raw: string | null): QuerySort[] | undefined {
  if (!raw) return undefined
  const allowed = queryableFields(entity)
  const sorts: QuerySort[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const desc = trimmed.startsWith('-')
    const field = desc ? trimmed.slice(1) : trimmed
    if (!allowed.has(field)) {
      throw new BadRequestError(`Unknown sort field: "${field}".`)
    }
    sorts.push({ field, direction: desc ? 'desc' : 'asc' })
  }
  return sorts.length > 0 ? sorts : undefined
}

/**
 * Parse `where[field]=value` equality filters. Values arrive as strings, so
 * they are coerced to the column's storage shape for number/boolean fields.
 */
function parseWhere(
  entity: Entity,
  params: URLSearchParams,
): Record<string, unknown> | undefined {
  const allowed = queryableFields(entity)
  const typeByName = new Map<string, string>()
  for (const field of entity.fields) {
    const f = field as { name: string; type: string }
    typeByName.set(f.name, f.type)
  }

  const where: Record<string, unknown> = {}
  for (const [key, value] of params.entries()) {
    const match = /^where\[(.+)\]$/.exec(key)
    if (!match) continue
    const field = match[1]!
    if (!allowed.has(field)) {
      throw new BadRequestError(`Unknown filter field: "${field}".`)
    }
    switch (typeByName.get(field)) {
      case 'number':
        where[field] = Number(value)
        break
      case 'boolean':
        where[field] = value === 'true'
        break
      default:
        where[field] = value
    }
  }
  return Object.keys(where).length > 0 ? where : undefined
}

/** Combine caller filters with the entity's delivery constraint (constraint wins). */
function mergeWhere(
  callerWhere: Record<string, unknown> | undefined,
  constraint: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!constraint) return callerWhere
  return { ...callerWhere, ...constraint }
}

/** Whether a fetched document satisfies the entity's delivery constraint. */
function matchesConstraint(
  doc: Record<string, unknown>,
  constraint: Record<string, unknown> | undefined,
): boolean {
  if (!constraint) return true
  return Object.entries(constraint).every(([key, value]) => doc[key] === value)
}

function parseBoundedInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * Resolve the caller: an API key bearer token, or the anonymous Public
 * principal. A presented-but-invalid token fails loudly (`null`) rather than
 * silently downgrading to Public.
 */
async function resolveApiPrincipal(
  kon10: Kon10Instance,
  request: Request,
  cors: Record<string, string>,
): Promise<{ principal: unknown } | { error: Response } | { anonymous: true; principal: unknown }> {
  const header = request.headers.get('authorization')
  if (!header) return { anonymous: true, principal: await resolveAnonymousPrincipal(kon10) }
  const [scheme, token] = header.split(' ', 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token?.startsWith(API_KEY_TOKEN_PREFIX)) {
    return {
      error: json(401, apiFailure(API_ERROR_CODES.UNAUTHORIZED, 'Unsupported authorization scheme.'), cors),
    }
  }
  const principal = await verifyApiKeyToken(kon10, token)
  if (!principal) {
    return {
      error: json(401, apiFailure(API_ERROR_CODES.UNAUTHORIZED, 'Invalid or expired API key.'), cors),
    }
  }
  return { principal }
}

/** One resolved delivery-API target: the entity to operate on, and an optional item id. */
interface ResolvedRoute {
  entity: Entity
  id?: string
}

/**
 * Resolve `[prefix, ...rest]` path segments to an entity (+ optional id),
 * scoped to the module that owns `prefix`. `rest` is at most 2 segments —
 * `[slug]`, `[slug, id]`, or, when the module contributes exactly one entity,
 * `[]` (that entity's list/singleton) or `[id]` (that entity's item).
 */
function resolveDeliveryRoute(kon10: Kon10Instance, segments: string[]): ResolvedRoute | undefined {
  const [prefix, ...rest] = segments
  if (!prefix || rest.length > 2) return undefined

  const module = kon10.modules.find((m) => moduleApiPrefix(m) === prefix)
  if (!module) return undefined
  const entities = (module.entities ?? []) as Entity[]

  if (rest.length === 0) {
    // `/api/v1/<prefix>` — unambiguous only when the module has one entity.
    return entities.length === 1 ? { entity: entities[0]! } : undefined
  }

  const [first, second] = rest as [string, string?]
  const bySlug = entities.find((e) => e.slug === first)
  if (bySlug) return { entity: bySlug, id: second }

  // `first` isn't any of this module's entity slugs — with exactly one
  // entity, read it as that entity's id instead (never with a second segment,
  // which would just be noise past the id).
  if (entities.length === 1 && second === undefined) {
    return { entity: entities[0]!, id: first }
  }

  return undefined
}

/** Answer a CORS preflight for the delivery API. */
export function handleDeliveryPreflight(
  config: ResolvedConfig,
  request: Request,
): Response {
  const headers = {
    ...corsHeaders(corsSettings(config), request.headers.get('origin')),
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
  }
  return new Response(null, { status: 204, headers })
}

/** Dispatch one delivery-API request. `basePath` defaults to `/api/v1`. */
export async function handleDeliveryRequest(
  config: ResolvedConfig,
  request: Request,
  basePath: string = DEFAULT_API_PATH,
): Promise<Response> {
  const settings = corsSettings(config)
  const cors = corsHeaders(settings, request.headers.get('origin'))

  if (request.method !== 'GET') {
    return json(
      405,
      apiFailure(API_ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.'),
      { ...cors, allow: 'GET, OPTIONS' },
    )
  }

  const url = new URL(request.url)
  const rest = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : ''
  const segments = rest.split('/').filter(Boolean).map(decodeURIComponent)
  if (segments.length < 1 || segments.length > 3) {
    return json(404, apiFailure(API_ERROR_CODES.NOT_FOUND, 'Not found.'), cors)
  }

  const kon10 = await getRuntime(config)
  const route = resolveDeliveryRoute(kon10, segments)
  if (!route) return json(404, apiFailure(API_ERROR_CODES.NOT_FOUND, 'Not found.'), cors)
  const { entity, id } = route
  const slug = entity.slug

  const resolved = await resolveApiPrincipal(kon10, request, cors)
  if ('error' in resolved) return resolved.error
  const opCtx = {
    cms: kon10,
    principal: resolved.principal,
    context: { enforce: true },
  }
  const hidden = hiddenFieldNames(entity)
  // The entity's delivery constraint (e.g. `{ status: 'published' }` from a
  // drafts-enabled collection). Applied to every read on this surface — the
  // Studio RPC is the place that sees drafts.
  const constraint = entity.api?.where

  // Read-through cache for this entity's delivery-API reads, backed by
  // whichever `CacheAdapter` a module registered (see `@kon10/cache`'s
  // `CacheModule`). The entity's own `api.cache` overrides the app-wide
  // `config.api.cache` when set — including an explicit `false`, since `??`
  // only falls through on `null`/`undefined`, never on `false`. TTL-only:
  // a write via the Studio RPC does not invalidate an already-cached entry.
  const cacheOpt = entity.api?.cache ?? config.api?.cache
  const cacheEnabled = kon10.cache !== undefined && cacheOpt !== false
  const cacheTtl = cacheOpt ? (cacheOpt.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS) : DEFAULT_CACHE_TTL_SECONDS
  const cacheKey = cacheEnabled ? deliveryCacheKey(request, url) : undefined

  if (cacheKey) {
    const cached = await kon10.cache!.get(cacheKey)
    if (cached !== undefined) return json(200, cached as ApiResponse<unknown>, cors)
  }

  /** Serve a success body, caching it (when enabled) before returning it. */
  async function respond(body: ApiResponse<unknown>): Promise<Response> {
    if (cacheKey) await kon10.cache!.set(cacheKey, body as unknown as JsonValue, cacheTtl)
    return json(200, body, cors)
  }

  try {
    if (entity.cardinality === 'single') {
      if (id !== undefined) return json(404, apiFailure(API_ERROR_CODES.NOT_FOUND, 'Not found.'), cors)
      const doc = await operations.findGlobal(opCtx, slug)
      if (!doc || !matchesConstraint(doc, constraint)) {
        return json(404, apiFailure(API_ERROR_CODES.NOT_FOUND, 'Not found.'), cors)
      }
      return respond(apiSuccess(projectDoc(hidden, doc)))
    }

    if (id !== undefined) {
      const doc = await operations.findOne(opCtx, slug, id)
      if (!doc || !matchesConstraint(doc, constraint)) {
        return json(404, apiFailure(API_ERROR_CODES.NOT_FOUND, 'Not found.'), cors)
      }
      return respond(apiSuccess(projectDoc(hidden, doc)))
    }

    const page = parseBoundedInt(url.searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER)
    const pageSize = parseBoundedInt(
      url.searchParams.get('pageSize'),
      LIST_DEFAULT_PAGE_SIZE,
      1,
      LIST_MAX_PAGE_SIZE,
    )
    const query: Query = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: parseSort(entity, url.searchParams.get('sort')),
      // The constraint spreads last: a caller's where[] can never widen it.
      where: mergeWhere(parseWhere(entity, url.searchParams), constraint),
    }
    const [docs, total] = await Promise.all([
      operations.find(opCtx, slug, query),
      operations.count(opCtx, slug, { where: query.where }),
    ])
    return respond(
      apiSuccess(
        docs.map((doc) => projectDoc(hidden, doc)),
        apiPaginationOf(total, page, pageSize),
      ),
    )
  } catch (err) {
    if (err instanceof BadRequestError) {
      return json(400, apiFailure(API_ERROR_CODES.BAD_REQUEST, err.message), cors)
    }
    if (err instanceof AccessDeniedError) {
      return json(403, apiFailure(API_ERROR_CODES.FORBIDDEN, 'Forbidden.'), cors)
    }
    console.error('[kon10] delivery API error:', err)
    return json(500, apiFailure(API_ERROR_CODES.INTERNAL_ERROR, 'Internal error.'), cors)
  }
}

/**
 * Public content delivery API — the headless read surface.
 *
 *   GET <api>/:slug           → paginated list  { docs, total, limit, offset }
 *   GET <api>/:slug/:id       → one document (404 when absent)
 *   GET <api>/:slug (single)  → the singleton document
 *
 * Query params on lists: `limit`, `offset`, `sort` (`-createdAt,name`), and
 * equality filters `where[field]=value`.
 *
 * Anonymous requests run as the Public role; `Authorization: Bearer latha_…`
 * runs as the API key's roles. Enforcement is always on — the RBAC guard
 * requires `<slug>:read` — so nothing is exposed until an admin grants the
 * Public role a read or issues a key. Fields marked `meta.hidden` (credential
 * material like `passwordHash`/`keyHash`) never leave this surface.
 *
 * Server-only: reached via dynamic `import()` from the route handler, exactly
 * like the RPC dispatcher.
 */

import {
  AccessDeniedError,
  operations,
  type Entity,
  type LathaInstance,
  type Query,
  type QuerySort,
  type ResolvedConfig,
} from '@latha/core'
import { verifyApiKeyToken, API_KEY_TOKEN_PREFIX } from '@latha/auth'
import { DEFAULT_API_PATH } from '@latha/admin-sdk'
import { getRuntime } from './runtime.js'
import { resolveAnonymousPrincipal } from './server.js'

const LIST_DEFAULT_LIMIT = 50
const LIST_MAX_LIMIT = 200

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
  body: unknown,
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

/** Fields whose `meta.hidden` flags credential material — never serialized here. */
function hiddenFieldNames(entity: Entity): Set<string> {
  const hidden = new Set<string>()
  for (const field of entity.fields) {
    const meta = (field as { meta?: { hidden?: boolean } }).meta
    if (meta?.hidden) hidden.add((field as { name: string }).name)
  }
  return hidden
}

function projectDoc(
  hidden: Set<string>,
  doc: Record<string, unknown>,
): Record<string, unknown> {
  if (hidden.size === 0) return doc
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (!hidden.has(key)) out[key] = value
  }
  return out
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
  latha: LathaInstance,
  request: Request,
): Promise<{ principal: unknown } | { error: Response } | { anonymous: true; principal: unknown }> {
  const header = request.headers.get('authorization')
  if (!header) return { anonymous: true, principal: await resolveAnonymousPrincipal(latha) }
  const [scheme, token] = header.split(' ', 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token?.startsWith(API_KEY_TOKEN_PREFIX)) {
    return { error: json(401, { error: 'Unsupported authorization scheme.' }, {}) }
  }
  const principal = await verifyApiKeyToken(latha, token)
  if (!principal) {
    return { error: json(401, { error: 'Invalid or expired API key.' }, {}) }
  }
  return { principal }
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

/** Dispatch one delivery-API request. `basePath` defaults to `/api`. */
export async function handleDeliveryRequest(
  config: ResolvedConfig,
  request: Request,
  basePath: string = DEFAULT_API_PATH,
): Promise<Response> {
  const settings = corsSettings(config)
  const cors = corsHeaders(settings, request.headers.get('origin'))

  if (request.method !== 'GET') {
    return json(405, { error: 'Method not allowed.' }, { ...cors, allow: 'GET, OPTIONS' })
  }

  const url = new URL(request.url)
  const rest = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : ''
  const segments = rest.split('/').filter(Boolean).map(decodeURIComponent)
  if (segments.length < 1 || segments.length > 2) {
    return json(404, { error: 'Not found.' }, cors)
  }
  const [slug, id] = segments as [string, string?]

  const latha = await getRuntime(config)
  const entity = latha.getEntity(slug)
  if (!entity) return json(404, { error: 'Not found.' }, cors)

  const resolved = await resolveApiPrincipal(latha, request)
  if ('error' in resolved) return resolved.error
  const opCtx = {
    cms: latha,
    principal: resolved.principal,
    context: { enforce: true },
  }
  const hidden = hiddenFieldNames(entity)
  // The entity's delivery constraint (e.g. `{ status: 'published' }` from a
  // drafts-enabled collection). Applied to every read on this surface — the
  // admin RPC is the place that sees drafts.
  const constraint = entity.api?.where

  try {
    if (entity.cardinality === 'single') {
      if (id !== undefined) return json(404, { error: 'Not found.' }, cors)
      const doc = await operations.findGlobal(opCtx, slug)
      if (!doc || !matchesConstraint(doc, constraint)) {
        return json(404, { error: 'Not found.' }, cors)
      }
      return json(200, projectDoc(hidden, doc), cors)
    }

    if (id !== undefined) {
      const doc = await operations.findOne(opCtx, slug, id)
      if (!doc || !matchesConstraint(doc, constraint)) {
        return json(404, { error: 'Not found.' }, cors)
      }
      return json(200, projectDoc(hidden, doc), cors)
    }

    const limit = parseBoundedInt(url.searchParams.get('limit'), LIST_DEFAULT_LIMIT, 1, LIST_MAX_LIMIT)
    const offset = parseBoundedInt(url.searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    const query: Query = {
      limit,
      offset,
      sort: parseSort(entity, url.searchParams.get('sort')),
      // The constraint spreads last: a caller's where[] can never widen it.
      where: mergeWhere(parseWhere(entity, url.searchParams), constraint),
    }
    const [docs, total] = await Promise.all([
      operations.find(opCtx, slug, query),
      operations.count(opCtx, slug, { where: query.where }),
    ])
    return json(
      200,
      { docs: docs.map((doc) => projectDoc(hidden, doc)), total, limit, offset },
      cors,
    )
  } catch (err) {
    if (err instanceof BadRequestError) {
      return json(400, { error: err.message }, cors)
    }
    if (err instanceof AccessDeniedError) {
      return json(403, { error: 'Forbidden.' }, cors)
    }
    console.error('[latha] delivery API error:', err)
    return json(500, { error: 'Internal error.' }, cors)
  }
}

/**
 * The headless delivery client — a thin, framework-agnostic wrapper over the
 * public content API (`@kon10/start`'s `/api/v1` surface).
 *
 * It knows exactly one thing about Kon10: the response envelope contract (see
 * `./envelope.ts`). Everything else — which entities exist, what a document
 * looks like — is the caller's to supply, either generically (`JsonDoc`) or by
 * passing a Zod schema per call (the `kon10 typegen` output binds here). It has
 * no framework imports, so it runs unchanged in a TanStack loader, a React
 * Server Component, a Vue app, or a plain Node script; reactive bindings
 * (`@kon10/client-react`, `@kon10/client-vue`) only wrap it.
 *
 * Addressing mirrors the server: `path` is the delivery route minus the base
 * path — `'contents/posts'`, or `'media'` for a single-entity module. `get`
 * appends an id; `single` reads a singleton entity.
 */
import { z } from 'zod'
import {
  API_ERROR_CODES,
  apiResponseSchema,
  type ApiError,
  type ApiPagination,
} from './envelope.js'

/** The default base path the delivery API is mounted at (see `@kon10/start`). */
export const DEFAULT_API_PATH = '/api/v1'

/** Prefix of a secret API key — must never reach the browser. */
const SECRET_KEY_PREFIX = 'kon10_sk_'

/** An untyped document — the fallback shape when no schema is supplied. */
export type JsonDoc = Record<string, unknown>

const jsonDocSchema = z.record(z.string(), z.unknown()) as unknown as z.ZodType<JsonDoc>

/** Values accepted in a `where[field]=value` equality filter. */
export type WhereValue = string | number | boolean

export interface DeliveryClientOptions {
  /** Origin hosting the delivery API, e.g. `https://cms.example.com`. */
  baseUrl: string
  /** Optional `kon10_…` API key; sent as `Authorization: Bearer`. Anonymous = Public role. */
  apiKey?: string
  /** Path the delivery API is mounted at. Defaults to `/api/v1`. */
  basePath?: string
  /** Injectable `fetch` for SSR/testing. Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Extra headers merged into every request. */
  headers?: Record<string, string>
}

export interface ListOptions<T> {
  /** 1-indexed page number. Defaults to the server's default (1). */
  page?: number
  /** Items per page. Server caps this (default 50, max 200). */
  pageSize?: number
  /** Sort spec, e.g. `-createdAt,name`. Passed through verbatim. */
  sort?: string
  /** `where[field]=value` equality filters. */
  where?: Record<string, WhereValue>
  /** Zod schema for one item; when given, `data` is validated and typed as `T`. */
  schema?: z.ZodType<T>
  signal?: AbortSignal
}

export interface GetOptions<T> {
  /** Zod schema for the document; when given, the result is validated and typed as `T`. */
  schema?: z.ZodType<T>
  signal?: AbortSignal
}

export interface ListResult<T> {
  data: T[]
  /** Present on list responses only. */
  pagination?: ApiPagination
}

/**
 * A delivery-API request that returned a failure envelope, a non-JSON body, or
 * a body that didn't match the envelope contract. `get`/`single` translate a
 * `NOT_FOUND` failure into `null` instead of throwing this.
 */
export class DeliveryError extends Error {
  override readonly name = 'DeliveryError'
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message)
  }
}

export interface DeliveryClient {
  /** A page of documents plus pagination. Throws `DeliveryError` on failure. */
  list<T = JsonDoc>(path: string, options?: ListOptions<T>): Promise<ListResult<T>>
  /** One document by id, or `null` when it doesn't exist. Throws on other failures. */
  get<T = JsonDoc>(path: string, id: string, options?: GetOptions<T>): Promise<T | null>
  /** A singleton entity's document, or `null` when unset. Throws on other failures. */
  single<T = JsonDoc>(path: string, options?: GetOptions<T>): Promise<T | null>
}

/** Split `'contents/posts'` into `['contents', 'posts']`, dropping empty segments. */
function pathSegments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

/** Create a delivery client bound to one Kon10 origin. */
export function createDeliveryClient(options: DeliveryClientOptions): DeliveryClient {
  const base = options.baseUrl.replace(/\/+$/, '')
  const rawBasePath = options.basePath ?? DEFAULT_API_PATH
  const basePath = `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available; pass `fetch` in DeliveryClientOptions.')
  }

  // A secret key must never ship to the browser. Fail loudly if one is used in
  // a browser context — use a publishable key (`kon10_pk_…`) client-side, and
  // keep secret keys to server-only code.
  if (
    options.apiKey?.startsWith(SECRET_KEY_PREFIX) &&
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  ) {
    throw new Error(
      'A secret API key (kon10_sk_…) was passed to createDeliveryClient in a browser context. ' +
        'Use a publishable key (kon10_pk_…) client-side; keep secret keys server-only.',
    )
  }

  function buildUrl(segments: string[], query?: URLSearchParams): string {
    const url = new URL(base)
    const encoded = segments.map(encodeURIComponent).join('/')
    url.pathname = `${basePath}/${encoded}`
    if (query && [...query.keys()].length > 0) url.search = query.toString()
    return url.toString()
  }

  function headers(): Record<string, string> {
    const h: Record<string, string> = { accept: 'application/json', ...options.headers }
    if (options.apiKey) h.authorization = `Bearer ${options.apiKey}`
    return h
  }

  /** Fetch `url`, then validate the body against the envelope for `dataSchema`. */
  async function requestEnvelope<D>(
    url: string,
    dataSchema: z.ZodType<D>,
    signal?: AbortSignal,
  ): Promise<{ data: D; pagination?: ApiPagination } | { error: ApiError; status: number }> {
    let res: Response
    try {
      res = await fetchImpl(url, { method: 'GET', headers: headers(), signal })
    } catch (err) {
      throw new DeliveryError('NETWORK', err instanceof Error ? err.message : String(err))
    }

    let body: unknown
    try {
      body = await res.json()
    } catch {
      throw new DeliveryError('MALFORMED', `Non-JSON response (HTTP ${res.status}).`, res.status)
    }

    const parsed = apiResponseSchema(dataSchema).safeParse(body)
    if (!parsed.success) {
      throw new DeliveryError('MALFORMED', 'Response did not match the delivery envelope.', res.status)
    }

    const env = parsed.data
    if (env.error !== null) return { error: env.error, status: res.status }
    return { data: env.data, pagination: env.pagination }
  }

  /** Turn a failure envelope into a thrown `DeliveryError`. */
  function fail(error: ApiError, status: number): never {
    throw new DeliveryError(error.code, error.message, status, error.requestId)
  }

  /** Read a single-document endpoint, mapping `NOT_FOUND` to `null`. */
  async function readOne<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T | null> {
    const result = await requestEnvelope(url, schema, signal)
    if ('error' in result) {
      if (result.error.code === API_ERROR_CODES.NOT_FOUND || result.status === 404) return null
      fail(result.error, result.status)
    }
    return result.data
  }

  return {
    async list<T = JsonDoc>(path: string, opts: ListOptions<T> = {}): Promise<ListResult<T>> {
      const itemSchema = (opts.schema ?? jsonDocSchema) as z.ZodType<T>
      const query = new URLSearchParams()
      if (opts.page != null) query.set('page', String(opts.page))
      if (opts.pageSize != null) query.set('pageSize', String(opts.pageSize))
      if (opts.sort) query.set('sort', opts.sort)
      if (opts.where) {
        for (const [field, value] of Object.entries(opts.where)) {
          query.set(`where[${field}]`, String(value))
        }
      }
      const url = buildUrl(pathSegments(path), query)
      const result = await requestEnvelope(url, z.array(itemSchema), opts.signal)
      if ('error' in result) fail(result.error, result.status)
      return { data: result.data, pagination: result.pagination }
    },

    async get<T = JsonDoc>(path: string, id: string, opts: GetOptions<T> = {}): Promise<T | null> {
      const schema = (opts.schema ?? jsonDocSchema) as z.ZodType<T>
      const url = buildUrl([...pathSegments(path), id])
      return readOne(url, schema, opts.signal)
    },

    async single<T = JsonDoc>(path: string, opts: GetOptions<T> = {}): Promise<T | null> {
      const schema = (opts.schema ?? jsonDocSchema) as z.ZodType<T>
      const url = buildUrl(pathSegments(path))
      return readOne(url, schema, opts.signal)
    },
  }
}

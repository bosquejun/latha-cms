/**
 * Typed client over the single Latha RPC endpoint.
 *
 * Each method packs an RPC action and unpacks the (already JSON-serializable)
 * result. This is what the admin components talk to; it never touches the
 * server directly.
 *
 * By default it POSTs to the framework's server route (`DEFAULT_RPC_PATH`), so
 * `createLathaClient()` works with zero app wiring. Pass a `LathaServerFn` (or
 * `{ serverFn }`) to route through your own `createServerFn` endpoint instead,
 * or `{ endpoint }` to point at a different path.
 */

import { DEFAULT_RPC_PATH, DEFAULT_UPLOAD_PATH } from './default-rpc.js'
import type {
  EntityDescriptor,
  JsonDoc,
  LathaRpcInput,
  LathaServerFn,
  NavSection,
  PageResult,
  SessionUser,
} from './rpc.js'

export interface LathaClient {
  nav(): Promise<NavSection[]>
  entity(slug: string): Promise<EntityDescriptor | null>
  list(slug: string): Promise<JsonDoc[]>
  /** One page of a list plus the total, for paginated views. */
  page(
    slug: string,
    query?: {
      limit?: number
      offset?: number
      sort?: { field: string; direction: 'asc' | 'desc' }[]
    },
  ): Promise<PageResult>
  get(slug: string, id: string): Promise<JsonDoc | null>
  create(slug: string, data: Record<string, unknown>): Promise<JsonDoc>
  update(slug: string, id: string, data: Record<string, unknown>): Promise<JsonDoc>
  remove(slug: string, id: string): Promise<{ id: string }>
  getGlobal(slug: string): Promise<JsonDoc | null>
  saveGlobal(slug: string, data: Record<string, unknown>): Promise<JsonDoc>
  currentUser(): Promise<SessionUser | null>
  login(
    email: string,
    password: string,
  ): Promise<{ ok: boolean; user: SessionUser | null; error?: string }>
  logout(): Promise<{ ok: true }>
  /** Upload a file via the dedicated multipart route (not the JSON RPC path). */
  upload(file: File, extra?: Record<string, string>): Promise<JsonDoc>
}

/** Options for the default (fetch-based) client transport. */
export interface LathaClientOptions {
  /** RPC endpoint to POST to. Defaults to `DEFAULT_RPC_PATH`. */
  endpoint?: string
  /** Use a custom server function instead of the built-in fetch transport. */
  serverFn?: LathaServerFn
}

/** POST one RPC action to the endpoint and return its JSON result. */
async function fetchRpc<T>(endpoint: string, data: LathaRpcInput): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error(`Latha RPC request failed (${res.status} ${res.statusText})`)
  }
  return res.json() as Promise<T>
}

/** POST a file (+ extra fields) to the upload endpoint as multipart form data. */
async function fetchUpload(
  endpoint: string,
  file: File,
  extra?: Record<string, string>,
): Promise<JsonDoc> {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(extra ?? {})) form.append(k, v)
  const res = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', body: form })
  if (!res.ok) {
    throw new Error(`Latha upload failed (${res.status} ${res.statusText})`)
  }
  return res.json() as Promise<JsonDoc>
}

/**
 * Build the typed client.
 *
 * - `createLathaClient()` — talks to the framework's RPC server route. No app
 *   wiring needed; this is the default.
 * - `createLathaClient({ endpoint })` — same, against a custom path.
 * - `createLathaClient(serverFn)` / `createLathaClient({ serverFn })` — route
 *   through your own `createServerFn` endpoint when you need to customize dispatch.
 */
export function createLathaClient(
  source: LathaServerFn | LathaClientOptions = {},
): LathaClient {
  const serverFn = typeof source === 'function' ? source : source.serverFn
  const endpoint =
    typeof source === 'function' ? DEFAULT_RPC_PATH : source.endpoint ?? DEFAULT_RPC_PATH

  const call = <T>(data: LathaRpcInput): Promise<T> =>
    serverFn ? (serverFn({ data }) as Promise<T>) : fetchRpc<T>(endpoint, data)

  return {
    nav: () => call<NavSection[]>({ action: 'nav' }),
    entity: (slug) => call<EntityDescriptor | null>({ action: 'entity', slug }),
    list: (slug) => call<JsonDoc[]>({ action: 'list', slug }),
    page: (slug, query) => call<PageResult>({ action: 'page', slug, ...query }),
    get: (slug, id) => call<JsonDoc | null>({ action: 'get', slug, id }),
    create: (slug, data) => call<JsonDoc>({ action: 'create', slug, data }),
    update: (slug, id, data) => call<JsonDoc>({ action: 'update', slug, id, data }),
    remove: (slug, id) => call<{ id: string }>({ action: 'remove', slug, id }),
    getGlobal: (slug) => call<JsonDoc | null>({ action: 'getGlobal', slug }),
    saveGlobal: (slug, data) =>
      call<JsonDoc>({ action: 'saveGlobal', slug, data }),
    currentUser: () => call<SessionUser | null>({ action: 'currentUser' }),
    login: (email, password) =>
      call<{ ok: boolean; user: SessionUser | null; error?: string }>({
        action: 'login',
        email,
        password,
      }),
    logout: () => call<{ ok: true }>({ action: 'logout' }),
    upload: (file, extra) => {
      if (serverFn) {
        throw new Error(
          'client.upload() requires the default fetch transport (no custom serverFn support yet).',
        )
      }
      return fetchUpload(DEFAULT_UPLOAD_PATH, file, extra)
    },
  }
}

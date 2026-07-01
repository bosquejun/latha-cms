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

import { DEFAULT_RPC_PATH } from './default-rpc.js'
import type {
  EntityDescriptor,
  JsonDoc,
  LathaRpcInput,
  LathaServerFn,
  NavSection,
  SessionUser,
} from './rpc.js'

export interface LathaClient {
  nav(): Promise<NavSection[]>
  entity(slug: string): Promise<EntityDescriptor | null>
  list(collection: string): Promise<JsonDoc[]>
  get(collection: string, id: string): Promise<JsonDoc | null>
  create(collection: string, data: Record<string, unknown>): Promise<JsonDoc>
  update(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<JsonDoc>
  remove(collection: string, id: string): Promise<{ id: string }>
  getGlobal(slug: string): Promise<JsonDoc | null>
  saveGlobal(slug: string, data: Record<string, unknown>): Promise<JsonDoc>
  currentUser(): Promise<SessionUser | null>
  login(
    email: string,
    password: string,
  ): Promise<{ ok: boolean; user: SessionUser | null }>
  logout(): Promise<{ ok: true }>
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
    list: (collection) => call<JsonDoc[]>({ action: 'list', collection }),
    get: (collection, id) => call<JsonDoc | null>({ action: 'get', collection, id }),
    create: (collection, data) =>
      call<JsonDoc>({ action: 'create', collection, data }),
    update: (collection, id, data) =>
      call<JsonDoc>({ action: 'update', collection, id, data }),
    remove: (collection, id) =>
      call<{ id: string }>({ action: 'remove', collection, id }),
    getGlobal: (slug) => call<JsonDoc | null>({ action: 'getGlobal', slug }),
    saveGlobal: (slug, data) =>
      call<JsonDoc>({ action: 'saveGlobal', slug, data }),
    currentUser: () => call<SessionUser | null>({ action: 'currentUser' }),
    login: (email, password) =>
      call<{ ok: boolean; user: SessionUser | null }>({
        action: 'login',
        email,
        password,
      }),
    logout: () => call<{ ok: true }>({ action: 'logout' }),
  }
}

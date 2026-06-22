/**
 * Typed client over the single Latha server function.
 *
 * Each method packs an RPC action and unpacks the (already JSON-serializable)
 * result. This is what the admin components talk to; it never touches the
 * server directly.
 */

import type {
  EntityDescriptor,
  JsonDoc,
  LathaServerFn,
  NavItem,
  SessionUser,
} from './rpc.js'

export interface LathaClient {
  nav(): Promise<NavItem[]>
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

/**
 * Build the typed client over the app's single Latha server function.
 *
 * Use `dispatchLathaRpc` + `lathaRpcValidator` to stand up the default endpoint,
 * or pass any `LathaServerFn` you like here to wrap or customize dispatch.
 */
export function createLathaClient(serverFn: LathaServerFn): LathaClient {
  const call = <T>(data: Parameters<LathaServerFn>[0]['data']) =>
    serverFn({ data }) as Promise<T>

  return {
    nav: () => call<NavItem[]>({ action: 'nav' }),
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

/**
 * Shared harness for the cross-module integration tests in this directory.
 *
 * These tests exercise the real request path — the RPC dispatcher
 * (`handleKon10Request`), the delivery API (`handleDeliveryRequest`), and the
 * module-route dispatcher (`handleModuleRoute`) — over a realistic module graph
 * (Users + Auth + Content + slug plugin + taxonomy + cache), mirroring
 * `apps/playground/kon10.config.base.ts` in miniature. `buildTestConfig` takes
 * the `DBAdapter` so the same graph runs over both the in-memory adapter (fast)
 * and a live `tursoAdapter({ url: ':memory:' })` (real SQL + marshaling).
 *
 * `getRuntime` memoizes one bootstrapped, seeded instance per config reference,
 * so tests call the handlers (which resolve the same instance) and can also grab
 * `await getRuntime(config)` to read the db directly — one seed, no double-boot.
 */

import {
  defineConfig,
  operations,
  silentLogger,
  type DBAdapter,
  type Doc,
  type Query,
  type ResolvedConfig,
} from '@kon10/core'
import {
  Collection,
  ContentModule,
  Document,
  Taxonomy,
  date,
  group,
  number,
  relationship,
  richtext,
  select,
  taxonomy,
  text,
  z,
} from '@kon10/content'
import { UsersModule, countUsers, createUser } from '@kon10/users'
import {
  AuthModule,
  getCatalog,
  getRoleByName,
  hasPermission,
  hashPassword,
  type AuthUser,
} from '@kon10/auth'
import { CacheModule, inMemoryCache } from '@kon10/cache'
import { handleModuleRoute } from '../module-routes.js'
import { handleKon10Request } from '../server.js'
import type { Kon10RpcInput } from '@kon10/studio-sdk'

export const ADMIN_EMAIL = 'admin@integration.test'
export const ADMIN_PASSWORD = 'admin-password'
export const AUTHOR_EMAIL = 'author@integration.test'
export const AUTHOR_PASSWORD = 'author-password'

/** Map-backed `DBAdapter` — the same fake the co-located handler tests use. */
export function memoryAdapter(): DBAdapter {
  const tables = new Map<string, Map<string, Doc>>()
  let seq = 0
  const table = (slug: string) => {
    let t = tables.get(slug)
    if (!t) tables.set(slug, (t = new Map()))
    return t
  }
  const matches = (doc: Doc, where?: Record<string, unknown>) =>
    Object.entries(where ?? {}).every(([k, v]) => doc[k] === v)

  return {
    async find(slug: string, query?: Query) {
      let rows = [...table(slug).values()].filter((d) => matches(d, query?.where))
      const offset = query?.offset ?? 0
      rows = rows.slice(offset, query?.limit != null ? offset + query.limit : undefined)
      return rows
    },
    async findOne(slug: string, id: string) {
      return table(slug).get(id) ?? null
    },
    async count(slug: string, query?: Query) {
      return [...table(slug).values()].filter((d) => matches(d, query?.where)).length
    },
    async create(slug: string, data: Record<string, unknown>) {
      const doc = { id: `r${++seq}`, ...data } as Doc
      table(slug).set(doc.id, doc)
      return doc
    },
    async update(slug: string, id: string, data: Record<string, unknown>) {
      const doc = { ...table(slug).get(id)!, ...data } as Doc
      table(slug).set(id, doc)
      return doc
    },
    async delete(slug: string, id: string) {
      table(slug).delete(id)
    },
    async migrate() {},
  }
}

/**
 * Build a realistic multi-module config over the supplied `db`. The seam under
 * test is the interplay the playground depends on:
 *  - `posts` carries the author-ownership `access.update/delete` predicates and
 *    the `beforeCreate` author-default hook (lifted from `kon10.config.base.ts`),
 *  - `pages` is a second collection with a self-referential parent,
 *  - `categories`/`tags` taxonomies back the `posts` reference fields,
 *  - `site-settings` is a singleton for the `saveGlobal`/`getGlobal` RPC actions.
 *
 * `seed` creates an admin, an `author` role (studio:access + posts:create/read
 * only — no blanket posts:update, so ownership predicates govern), an author
 * user, and a couple of taxonomy terms — the same first-run path the playground
 * runs.
 */
export function buildTestConfig(db: DBAdapter): ResolvedConfig {
  return defineConfig({
    db,
    logger: silentLogger,
    modules: [
      UsersModule(),
      AuthModule({ secret: 'integration-test-secret' }),
      CacheModule({ cache: inMemoryCache() }),
      ContentModule({
        apiPrefix: 'contents',
        entities: [
          Document({
            slug: 'site-settings',
            studio: { area: 'settings', group: '' },
            fields: {
              site_name: text({ required: true }),
              tagline: text(),
            },
          }),
          Collection({
            slug: 'posts',
            studio: { useAsTitle: 'title', defaultColumns: ['title', 'status'] },
            // `update`/`delete` fall back to an ownership check for holders of a
            // role (like `author`) that lacks the blanket posts:update/delete
            // permission; editors/admins still pass via the permission branch.
            access: {
              update: ({ principal, doc }) => {
                const user = principal as AuthUser | undefined
                if (!user) return false
                return hasPermission(user, 'posts:update') || user.id === doc?.author
              },
              delete: ({ principal, doc }) => {
                const user = principal as AuthUser | undefined
                if (!user) return false
                return hasPermission(user, 'posts:delete') || user.id === doc?.author
              },
            },
            hooks: {
              // Authors (lacking posts:update) can only ever write as themselves;
              // editors/admins may still assign authorship explicitly. Defaults
              // `author` to the creator when left blank.
              beforeCreate: [
                ({ data, principal }) => {
                  const user = principal as AuthUser | undefined
                  if (!user) return data
                  const canAssignOthers = hasPermission(user, 'posts:update')
                  if (!canAssignOthers || !data.author) {
                    return { ...data, author: user.id }
                  }
                  return data
                },
              ],
            },
            fields: {
              title: text({ required: true }),
              excerpt: text({ meta: { multiline: true } }),
              content: richtext(),
              views: number({ integer: true, defaultValue: 0 }),
              seo: group({
                fields: {
                  metaTitle: text(),
                  metaDescription: text({ meta: { multiline: true } }),
                },
              }),
              status: select({
                options: z.enum(['draft', 'published']),
                defaultValue: 'draft',
                meta: { sidebar: true },
              }),
              category: taxonomy({ to: 'categories', meta: { sidebar: true } }),
              tags: taxonomy({ to: 'tags', many: true, meta: { sidebar: true } }),
              author: relationship({ to: 'users', meta: { sidebar: true } }),
              publishedAt: date({ meta: { sidebar: true } }),
            },
          }),
          Taxonomy({ slug: 'categories', hierarchical: true }),
          Taxonomy({ slug: 'tags' }),
          Collection({
            slug: 'pages',
            studio: { useAsTitle: 'title' },
            fields: {
              title: text({ required: true }),
              parent: relationship({ to: 'pages', meta: { sidebar: true } }),
              status: select({
                options: z.enum(['draft', 'published']),
                defaultValue: 'draft',
                meta: { sidebar: true },
              }),
            },
          }),
        ],
      }),
    ],

    seed: async (kon10) => {
      if ((await countUsers(kon10)) === 0) {
        const adminRole = await getRoleByName(kon10, 'admin')
        await createUser(kon10, {
          email: ADMIN_EMAIL,
          name: 'Admin',
          roles: adminRole ? [adminRole.id] : [],
          passwordHash: await hashPassword(ADMIN_PASSWORD),
        })
      }

      // The `author` role: Studio access + posts:create/read only. Without a
      // blanket posts:update/delete grant, the posts `access` predicates fall
      // back to the id === doc.author ownership check.
      let authorRole = await getRoleByName(kon10, 'author')
      if (!authorRole) {
        const catalog = getCatalog(kon10)
        const permissions = ['studio:access', 'posts:create', 'posts:read']
          .map((key) => catalog?.permissionIdByKey.get(key))
          .filter((id): id is string => typeof id === 'string')
        authorRole = await kon10.db.create('roles', {
          name: 'author',
          label: 'Author',
          description: 'Can write and manage their own posts.',
          permissions,
          system: false,
        })
      }

      const existingAuthor = await kon10.db.find('users', { where: { email: AUTHOR_EMAIL }, limit: 1 })
      if (existingAuthor.length === 0) {
        await createUser(kon10, {
          email: AUTHOR_EMAIL,
          name: 'Author',
          roles: authorRole ? [authorRole.id] : [],
          passwordHash: await hashPassword(AUTHOR_PASSWORD),
        })
      }

      // A system principal bypasses RBAC guards — matches how the playground
      // seeds taxonomy terms.
      const sys = { cms: kon10, principal: { id: '__system__', permissions: ['*'] } }
      if ((await kon10.db.count('categories')) === 0) {
        await operations.create(sys, 'categories', { name: 'Engineering', slug: 'engineering' })
        await operations.create(sys, 'categories', { name: 'Design', slug: 'design' })
      }
      if ((await kon10.db.count('tags')) === 0) {
        for (const name of ['ts', 'cms']) {
          await operations.create(sys, 'tags', { name, slug: name })
        }
      }
    },
  })
}

/**
 * Drive a real login through the module-route dispatcher and return the
 * `kon10_session=<token>` cookie pair (name=value, no attributes) for use on
 * subsequent RPC calls. Throws if no session cookie came back.
 */
export async function login(
  config: ResolvedConfig,
  email: string,
  password: string,
): Promise<string> {
  const request = new Request('http://localhost/__kon10/modules/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const res = await handleModuleRoute(config, request)
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error(`login failed for ${email}: ${JSON.stringify(await res.json())}`)
  }
  return setCookie.split(';')[0]!
}

/**
 * Dispatch one RPC action through `handleKon10Request` exactly as the route
 * handler does, optionally carrying a session cookie. Returns the action result;
 * denials surface as a thrown `AccessDeniedError` (assert via `assert.rejects`).
 */
export function rpc(
  config: ResolvedConfig,
  input: Kon10RpcInput,
  cookie?: string,
): Promise<unknown> {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  const request = new Request('http://localhost/__kon10/rpc', { method: 'POST', headers })
  return handleKon10Request(config, input, request)
}

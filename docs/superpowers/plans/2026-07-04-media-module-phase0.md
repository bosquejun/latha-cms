# Phase 0 — Media Module Foundation: Implementation Plan

> Implements Phase 0 of `docs/superpowers/plans/2026-07-04-writer-fields-roadmap.md`.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `@kon10/media` — a `media` entity, a `media` field type,
a pluggable blob-`StorageAdapter` seam (with a local-disk implementation for
dev), a dedicated upload transport, and the admin-UI upload/picker field —
so any collection can add `media()` fields (starting with `posts.featuredImage`
in Phase 1) with zero further core changes.

**Architecture recap (from the roadmap doc):** domain data is module-first
(`@kon10/media` owns the entity, field type, and storage adapter — per
`CLAUDE.md`'s package table), admin UI is extension-first (`@kon10/media/admin`,
same `admin.ui` barrel contract `@kon10/auth` already proved).

**Tech stack:** TypeScript (NodeNext), Zod, React 19, TanStack Start + Vite,
pnpm workspaces, `node:test`.

## Global constraints

- `@kon10/media`'s **main** entry (`dist/index.js`) stays server-only: no
  React / `@kon10/ui` / `@kon10/admin-sdk` / `@kon10/start` imports. Client
  deps live solely behind the `./admin` subpath (same split as `@kon10/auth`).
- `@kon10/media` must **not** import `@kon10/content` — media builds its raw
  `Entity` object directly (the same way `@kon10/users` does), not via
  `Collection()`. Lateral module-to-module imports violate the dependency
  direction in `CLAUDE.md` ("always inward toward core, never across modules").
- `StorageAdapter` (the contract) already exists in `@kon10/core`
  (`packages/core/src/types/adapter.ts:54-57`) — it's declared but currently
  unwired into `Kon10Config`/`Kon10Instance`. Task 1 wires it; nothing about
  the interface shape itself needs to change.
- The RBAC guard (`packages/modules/auth/src/rbac/guard.ts`) enforces
  `"<slug>:<operation>"` automatically for any entity with `actions` set, as
  long as the caller sets `context.enforce = true` on the `OperationContext`
  — the upload dispatcher gets this for free by calling `operations.create`
  the same way `dispatchKon10Rpc` does. No new access-control code needed.
- Run `pnpm -w typecheck` before any "done" claim. Rebuild `@kon10/core`
  (`pnpm --filter @kon10/core build`) after Task 1 before typechecking
  dependent packages, per `CLAUDE.md`.
- TDD, DRY, YAGNI, frequent commits.

---

### Task 1: `storage` slot on `Kon10Config` / `Kon10Instance` (`@kon10/core`)

**Files:**
- Modify: `packages/core/src/types/config.ts`
- Modify: `packages/core/src/bootstrap/index.ts`
- Create: `packages/core/src/types/config.storage.test.ts`

**Interfaces:**
- Produces: `Kon10Config.storage?: StorageAdapter`, `Kon10Instance.storage?: StorageAdapter`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/types/config.storage.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapKon10, defineConfig } from '../bootstrap/index.js'
import type { DBAdapter, StorageAdapter } from './adapter.js'

function fakeDb(): DBAdapter {
  return {
    async find() { return [] },
    async findOne() { return null },
    async count() { return 0 },
    async create(_c, data) { return { id: '1', ...data } },
    async update(_c, id, data) { return { id, ...data } },
    async delete() {},
    async migrate() {},
  }
}

test('Kon10Instance exposes the configured storage adapter', async () => {
  const storage: StorageAdapter = {
    async upload() { return { url: '/x', key: 'x' } },
    async delete() {},
  }
  const kon10 = await bootstrapKon10(defineConfig({ db: fakeDb(), modules: [], storage }))
  assert.equal(kon10.storage, storage)
})

test('storage is undefined when not configured', async () => {
  const kon10 = await bootstrapKon10(defineConfig({ db: fakeDb(), modules: [] }))
  assert.equal(kon10.storage, undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kon10/core exec tsc -p tsconfig.json && node --test packages/core/dist/types/config.storage.test.js`
Expected: FAIL — TS2353, `storage` does not exist on `Kon10Config`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/types/config.ts
import type { DBAdapter, StorageAdapter } from './adapter.js'
// ... (AnyEntity, Guard, FieldTypeEntry imports unchanged)

export interface Kon10Instance {
  config: ResolvedConfig
  db: DBAdapter
  /** Optional blob/file storage adapter — set when a module (e.g. `@kon10/media`) needs one. */
  storage?: StorageAdapter
  entities: AnyEntity[]
  getEntity(slug: string): AnyEntity | undefined
  modules: Module[]
  guards: Guard[]
  registerGuard(guard: Guard): void
  registerFieldType(entry: FieldTypeEntry): void
  ready: boolean
}

// ...

export interface Kon10Config {
  db: DBAdapter
  /**
   * Optional blob/file storage backend. Required by any module that stores
   * files (e.g. `@kon10/media`) — omit if none are configured. Wired straight
   * through to `Kon10Instance.storage`, same as `db`.
   */
  storage?: StorageAdapter
  modules: Module[]
  plugins?: Plugin[]
  adminPath?: string
  seed?: (kon10: Kon10Instance) => void | Promise<void>
}
```

```ts
// packages/core/src/bootstrap/index.ts — inside class Kon10
class Kon10 implements Kon10Instance {
  readonly config: ResolvedConfig
  readonly db: ResolvedConfig['db']
  readonly storage: ResolvedConfig['storage']
  modules: Module[] = []
  entities: Entity[] = []
  guards: Guard[] = []
  ready = false

  // ...

  constructor(config: ResolvedConfig) {
    this.config = config
    this.db = config.db
    this.storage = config.storage
  }
  // ... rest unchanged
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kon10/core exec tsc -p tsconfig.json && node --test packages/core/dist/types/config.storage.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Rebuild core + commit**

```bash
pnpm --filter @kon10/core build
git add packages/core/src/types/config.ts packages/core/src/bootstrap/index.ts packages/core/src/types/config.storage.test.ts
git commit -m "feat(core): wire the StorageAdapter contract onto Kon10Config/Kon10Instance"
```

---

### Task 2: `@kon10/media` package scaffold + local-disk `StorageAdapter`

**Files:**
- Create: `packages/modules/media/package.json`
- Create: `packages/modules/media/tsconfig.json`
- Create: `packages/modules/media/src/storage/local-disk.ts`
- Create: `packages/modules/media/src/storage/local-disk.test.ts`
- Create: `packages/modules/media/src/index.ts` (barrel — extended in later tasks)

**Interfaces:**
- Consumes: `StorageAdapter` from `@kon10/core`.
- Produces: `localDiskStorage(opts: LocalDiskStorageOptions): StorageAdapter`.

- [ ] **Step 1: Package scaffold**

```jsonc
// packages/modules/media/package.json
{
  "name": "@kon10/media",
  "version": "0.0.0",
  "description": "Kon10 media — MediaModule, storage adapters, and the media field type.",
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./src/index.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "tsc -p tsconfig.json && node --test dist/"
  },
  "peerDependencies": {
    "@kon10/core": "workspace:*"
  },
  "devDependencies": {
    "@kon10/core": "workspace:*",
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2"
  }
}
```

```jsonc
// packages/modules/media/tsconfig.json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "composite": true
  },
  "references": [{ "path": "../../core" }],
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "src/admin"]
}
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/modules/media/src/storage/local-disk.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { localDiskStorage } from './local-disk.js'

test('localDiskStorage writes the file and returns a url/key', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kon10-media-'))
  const storage = localDiskStorage({ dir, publicPath: '/uploads' })
  const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })

  const { url, key } = await storage.upload(file)

  assert.match(url, /^\/uploads\/.+-photo\.jpg$/)
  assert.equal(key, url.slice('/uploads/'.length))
  const written = await readFile(path.join(dir, key))
  assert.deepEqual([...written], [1, 2, 3])

  await storage.delete(key)
  await assert.rejects(() => stat(path.join(dir, key)))
})

test('delete is idempotent for a missing key', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kon10-media-'))
  const storage = localDiskStorage({ dir })
  await storage.delete('nonexistent-key') // must not throw
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm install && pnpm --filter @kon10/media exec tsc -p tsconfig.json && node --test packages/modules/media/dist/storage/local-disk.test.js`
Expected: FAIL — `local-disk.js` does not exist.

- [ ] **Step 4: Write minimal implementation**

```ts
// packages/modules/media/src/storage/local-disk.ts
/**
 * Local-disk `StorageAdapter` — writes into the app's own `public/` directory
 * so Vite/TanStack Start serve the file back at `publicPath` with no extra
 * routing. Dev-only: there's no persistent disk on serverless deploys, so
 * production apps should configure an R2/S3-compatible adapter instead (a
 * later phase — not built here).
 */
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StorageAdapter } from '@kon10/core'

export interface LocalDiskStorageOptions {
  /** Directory files are written to, e.g. `./public/uploads`. */
  dir: string
  /** URL prefix the stored files are served under. Default `/uploads`. */
  publicPath?: string
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function localDiskStorage(opts: LocalDiskStorageOptions): StorageAdapter {
  const { dir } = opts
  const publicPath = (opts.publicPath ?? '/uploads').replace(/\/+$/, '')

  return {
    async upload(file: File) {
      await mkdir(dir, { recursive: true })
      const key = `${randomUUID()}-${sanitize(file.name)}`
      const bytes = new Uint8Array(await file.arrayBuffer())
      await writeFile(path.join(dir, key), bytes)
      return { url: `${publicPath}/${key}`, key }
    },
    async delete(key: string) {
      await unlink(path.join(dir, key)).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== 'ENOENT') throw err
      })
    },
  }
}
```

```ts
// packages/modules/media/src/index.ts
export { localDiskStorage, type LocalDiskStorageOptions } from './storage/local-disk.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @kon10/media exec tsc -p tsconfig.json && node --test packages/modules/media/dist/storage/local-disk.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/modules/media pnpm-lock.yaml
git commit -m "feat(media): scaffold @kon10/media with a local-disk StorageAdapter"
```

---

### Task 3: `media` field type + `media()` builder + `MediaModule` entity

**Files:**
- Create: `packages/modules/media/src/builders.ts`
- Create: `packages/modules/media/src/entities.ts`
- Create: `packages/modules/media/src/module.ts`
- Create: `packages/modules/media/src/module.test.ts`
- Modify: `packages/modules/media/src/index.ts`

**Interfaces:**
- Produces: `media(opts?)` builder, `MEDIA_SLUG`, `MediaModule(config?): Module`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/modules/media/src/module.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { fieldRegistry, type Kon10Instance } from '@kon10/core'
import { MediaModule } from './module.js'
import { MEDIA_SLUG } from './entities.js'

function fakeCms(storage?: unknown): Kon10Instance {
  return {
    storage,
    registerFieldType: (entry) => fieldRegistry.register(entry),
  } as unknown as Kon10Instance
}

test('MediaModule contributes the media entity with grantable actions', () => {
  const mod = MediaModule()
  const media = mod.entities?.find((e) => e.slug === MEDIA_SLUG)
  assert.ok(media)
  assert.deepEqual(media.actions, ['read', 'create', 'update', 'delete'])
})

test('MediaModule.onInit throws without a configured storage adapter', async () => {
  const mod = MediaModule()
  await assert.rejects(() => Promise.resolve(mod.onInit?.(fakeCms(undefined))))
})

test('MediaModule.onInit registers the media field type', async () => {
  const mod = MediaModule()
  await mod.onInit?.(fakeCms({ upload: async () => ({ url: '', key: '' }), delete: async () => {} }))
  assert.ok(fieldRegistry.has('media'))
  const built = fieldRegistry.buildDocumentSchema([{ name: 'cover', type: 'media', required: true }])
  assert.deepEqual(built.shape.cover, z.string())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kon10/media exec tsc -p tsconfig.json && node --test packages/modules/media/dist/module.test.js`
Expected: FAIL — `module.js`/`entities.js` don't exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/modules/media/src/builders.ts
/**
 * The `media()` field builder. A dedicated field type (not
 * `relationship({ to: 'media' })`) so `@kon10/media/admin` can register its
 * own upload/picker renderer without teaching the generic relationship
 * renderer anything about media — same rationale as `taxonomy`.
 */
import type { FieldMeta, PhantomMeta } from '@kon10/core'

interface MediaOpts {
  required?: boolean
  meta?: FieldMeta
}

type IsPresent<O> = O extends { required: true } ? true : false

type MediaBuilt<O extends MediaOpts> = O & {
  type: 'media'
} & PhantomMeta<string, IsPresent<O>>

/** Reference to a `media` doc by id. Stores the media doc's id as a string. */
export function media<const O extends MediaOpts = {}>(opts?: O): MediaBuilt<O> {
  return { ...(opts ?? {}), type: 'media' } as MediaBuilt<O>
}
```

```ts
// packages/modules/media/src/entities.ts
import { relationship, stampFields, text, number, type Entity, type FieldsRecord } from '@kon10/core'

export const MEDIA_SLUG = 'media'

/**
 * Built directly (not via `@kon10/content`'s `Collection()`) — media must not
 * depend on the content module (lateral module-to-module import), same as
 * `@kon10/users` builds its raw `Entity` by hand.
 */
export function buildMediaEntity(): Entity {
  const fields: FieldsRecord = {
    filename: text({ required: true }),
    mimeType: text({ required: true }),
    size: number({ integer: true, required: true }),
    url: text({ required: true }),
    key: text({ required: true, meta: { hidden: true, description: 'Internal storage key.' } }),
    alt: text({ meta: { label: 'Alt text', description: 'Describes the image for accessibility and SEO.' } }),
    uploadedBy: relationship({ to: 'users', meta: { sidebar: true, hidden: true } }),
  }

  return {
    kind: 'collection',
    cardinality: 'many',
    slug: MEDIA_SLUG,
    timestamps: true,
    actions: ['read', 'create', 'update', 'delete'],
    admin: {
      segment: 'content',
      useAsTitle: 'filename',
      defaultColumns: ['filename', 'mimeType', 'size'],
      labels: { singular: 'Media', plural: 'Media Library' },
    },
    fields: stampFields(fields),
  }
}
```

```ts
// packages/modules/media/src/module.ts
import { z } from 'zod'
import type { Kon10Instance, Module } from '@kon10/core'
import { buildMediaEntity } from './entities.js'

export interface MediaModuleConfig {}

export function MediaModule(_config: MediaModuleConfig = {}): Module {
  return {
    name: 'media',
    capabilities: ['media'],
    admin: { nav: { label: 'Media', order: 25 } },
    entities: [buildMediaEntity()],
    onInit(cms: Kon10Instance) {
      if (!cms.storage) {
        throw new Error(
          '[kon10] MediaModule requires a storage adapter — pass `storage` to defineConfig().',
        )
      }
      cms.registerFieldType({
        configSchema: z.object({ type: z.literal('media') }),
        buildDataSchema: () => z.string(),
      })
    },
  }
}
```

```ts
// packages/modules/media/src/index.ts — add
export { media } from './builders.js'
export { MediaModule, type MediaModuleConfig } from './module.js'
export { MEDIA_SLUG, buildMediaEntity } from './entities.js'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kon10/media exec tsc -p tsconfig.json && node --test packages/modules/media/dist/module.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/modules/media/src/builders.ts packages/modules/media/src/entities.ts packages/modules/media/src/module.ts packages/modules/media/src/module.test.ts packages/modules/media/src/index.ts
git commit -m "feat(media): media field type, media() builder, and MediaModule entity"
```

---

### Task 4: Extract `resolvePrincipal` in `@kon10/start` (DRY prep)

The upload dispatcher needs the same session→principal resolution
`handleKon10Request` already does. Extract it first so Task 5 doesn't
duplicate cookie/session logic.

**Files:**
- Modify: `packages/start/src/server.ts`
- Create: `packages/start/src/server.resolve-principal.test.ts`

**Interfaces:**
- Produces: `export async function resolvePrincipal(kon10: Kon10Instance): Promise<{ sessionUser: AuthUser | null; principal: AuthUser | PublicPrincipal }>`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/start/src/server.resolve-principal.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePrincipal } from './server.js'

test('resolvePrincipal is exported', () => {
  assert.equal(typeof resolvePrincipal, 'function')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kon10/start exec tsc -p tsconfig.json && node --test packages/start/dist/server.resolve-principal.test.js`
Expected: FAIL — `resolvePrincipal` is `undefined`.

- [ ] **Step 3: Extract the function**

```ts
// packages/start/src/server.ts — replace the two lines inside handleKon10Request:
//   const sessionUser = await currentAuthUser(kon10)
//   const principal: AuthUser | PublicPrincipal = sessionUser ?? (await getCachedPublicPrincipal(kon10))
// with:
  const { sessionUser, principal } = await resolvePrincipal(kon10)

// and add this exported function near currentAuthUser/getCachedPublicPrincipal:

/**
 * Resolve the caller for an incoming request: the actual logged-in user (for
 * `currentUser` / login redirects) and the effective principal for
 * enforcement — the user, or the synthetic Public principal for anonymous
 * requests. Shared by the RPC dispatcher and the upload dispatcher so both
 * transports authenticate identically.
 */
export async function resolvePrincipal(
  kon10: Kon10Instance,
): Promise<{ sessionUser: AuthUser | null; principal: AuthUser | PublicPrincipal }> {
  const sessionUser = await currentAuthUser(kon10)
  const principal: AuthUser | PublicPrincipal = sessionUser ?? (await getCachedPublicPrincipal(kon10))
  return { sessionUser, principal }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kon10/start exec tsc -p tsconfig.json && node --test packages/start/dist/server.resolve-principal.test.js`
Expected: PASS.

- [ ] **Step 5: Regression check + commit**

Run: `pnpm --filter @kon10/start exec tsc -p tsconfig.json && node --test packages/start/dist/`
Expected: all existing `@kon10/start` tests still PASS (no behavior change, pure extraction).

```bash
git add packages/start/src/server.ts packages/start/src/server.resolve-principal.test.ts
git commit -m "refactor(start): extract resolvePrincipal for reuse by the upload dispatcher"
```

---

### Task 5: `dispatchKon10Upload` + `/__kon10/upload` route + Vite wiring

**Files:**
- Create: `packages/start/src/upload.ts`
- Create: `packages/start/src/upload.test.ts`
- Create: `packages/start/src/routes/upload.ts`
- Modify: `packages/admin-sdk/src/client/default-rpc.ts` (add `DEFAULT_UPLOAD_PATH`)
- Modify: `packages/admin-sdk/src/client/index.ts`, `packages/admin-sdk/src/index.ts` (export it)
- Modify: `packages/start/src/index.ts` (re-export it)
- Modify: `packages/start/src/vite.ts` (mount the route)

**Interfaces:**
- Consumes: `resolvePrincipal` (Task 4), `operations`, `AccessDeniedError` from `@kon10/core`, `hasPermission`/`ADMIN_ACCESS` from `@kon10/auth`.
- Produces: `dispatchKon10Upload(config: ResolvedConfig, request: Request): Promise<JsonValue>`.

- [ ] **Step 1: Add the path constant**

```ts
// packages/admin-sdk/src/client/default-rpc.ts — add alongside DEFAULT_RPC_PATH
export const DEFAULT_UPLOAD_PATH = '/__kon10/upload'
```

Re-export it from `packages/admin-sdk/src/client/index.ts` and `packages/admin-sdk/src/index.ts` next to `DEFAULT_RPC_PATH`, and from `packages/start/src/index.ts`'s existing `export { kon10RpcValidator, DEFAULT_RPC_PATH } from '@kon10/admin-sdk'` line (add `DEFAULT_UPLOAD_PATH`).

- [ ] **Step 2: Write the failing test**

```ts
// packages/start/src/upload.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dispatchKon10Upload } from './upload.js'
import type { ResolvedConfig } from '@kon10/core'

// Minimal fake config: no auth module wired, so resolvePrincipal falls back
// to the public principal, which never holds ADMIN_ACCESS — asserts the
// 401/403 path without needing a real session.
test('dispatchKon10Upload rejects unauthenticated requests', async () => {
  const config = {
    db: {
      find: async () => [], findOne: async () => null, count: async () => 0,
      create: async (_c: string, d: Record<string, unknown>) => ({ id: '1', ...d }),
      update: async (_c: string, id: string, d: Record<string, unknown>) => ({ id, ...d }),
      delete: async () => {}, migrate: async () => {},
    },
    modules: [],
    plugins: [],
    adminPath: '/admin',
  } as unknown as ResolvedConfig

  const form = new FormData()
  form.append('file', new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }))
  const request = new Request('http://localhost/__kon10/upload', { method: 'POST', body: form })

  await assert.rejects(() => dispatchKon10Upload(config, request))
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @kon10/start exec tsc -p tsconfig.json && node --test packages/start/dist/upload.test.js`
Expected: FAIL — `upload.js` does not exist.

- [ ] **Step 4: Write minimal implementation**

```ts
// packages/start/src/upload.ts
/**
 * Server-only upload dispatcher for the media file route. Binary payloads
 * can't go through the JSON-only `/__kon10/rpc` endpoint, so uploads get
 * their own route — but authentication and persistence reuse the exact same
 * pieces `dispatchKon10Rpc` uses (`resolvePrincipal`, `operations.create`),
 * so RBAC enforcement, validation, and hooks are identical to any other
 * collection create. The only upload-specific step is turning bytes into a
 * URL via the configured `StorageAdapter` first.
 */
import {
  operations,
  AccessDeniedError,
  type JsonValue,
  type OperationContext,
  type ResolvedConfig,
} from '@kon10/core'
import { hasPermission, ADMIN_ACCESS } from '@kon10/auth'
import { getRuntime } from './runtime.js'
import { resolvePrincipal } from './server.js'

const MEDIA_SLUG = 'media'

function toJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export async function dispatchKon10Upload(
  config: ResolvedConfig,
  request: Request,
): Promise<JsonValue> {
  const kon10 = await getRuntime(config)
  const { principal } = await resolvePrincipal(kon10)

  if (!hasPermission(principal, ADMIN_ACCESS)) {
    throw new AccessDeniedError('read', 'admin')
  }
  if (!kon10.storage) {
    throw new Error('[kon10] No storage adapter configured — pass `storage` to defineConfig().')
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    throw new Error('Upload request must include a "file" field.')
  }
  const alt = form.get('alt')

  const { url, key } = await kon10.storage.upload(file)

  const opCtx: OperationContext = { cms: kon10, principal, context: { enforce: true } }
  const doc = await operations.create(opCtx, MEDIA_SLUG, {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    url,
    key,
    ...(typeof alt === 'string' && alt ? { alt } : {}),
  })

  return toJson(doc)
}
```

```ts
// packages/start/src/routes/upload.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = (createFileRoute as (path: string) => any)('/__kon10/upload')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ default: config }, { dispatchKon10Upload }] = await Promise.all([
          import('virtual:kon10/config'),
          import('../upload.js'),
        ])
        const result = await dispatchKon10Upload(config, request)
        return Response.json(result)
      },
    },
  },
})
```

```ts
// packages/start/src/vite.ts — imports
import { DEFAULT_RPC_PATH, DEFAULT_UPLOAD_PATH } from '@kon10/admin-sdk'

// inside kon10Start(), virtualRouteConfig:
  const virtualRouteConfig = rootRoute('__root.tsx', [
    physical('', '.'),
    route(loginPath, routeFile('@kon10/start/routes/login')),
    route(`${adminBasePath}/$`, routeFile('@kon10/start/routes/admin')),
    route(DEFAULT_RPC_PATH, routeFile('@kon10/start/routes/rpc')),
    route(DEFAULT_UPLOAD_PATH, routeFile('@kon10/start/routes/upload')),
  ])
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @kon10/start exec tsc -p tsconfig.json && node --test packages/start/dist/upload.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/admin-sdk/src/client/default-rpc.ts packages/admin-sdk/src/client/index.ts packages/admin-sdk/src/index.ts packages/start/src/upload.ts packages/start/src/upload.test.ts packages/start/src/routes/upload.ts packages/start/src/vite.ts packages/start/src/index.ts
git commit -m "feat(start): dedicated /__kon10/upload route + dispatchKon10Upload"
```

---

### Task 6: `Kon10Client.upload()`

**Files:**
- Modify: `packages/admin-sdk/src/client/client.ts`
- Create: `packages/admin-sdk/src/client/client.upload.test.ts`

**Interfaces:**
- Produces: `Kon10Client.upload(file: File, extra?: Record<string, string>): Promise<JsonDoc>`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/admin-sdk/src/client/client.upload.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createKon10Client } from './client.js'

test('upload posts multipart form data to DEFAULT_UPLOAD_PATH', async (t) => {
  const calls: { url: string; body: unknown }[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body })
    return new Response(JSON.stringify({ id: 'm1', url: '/uploads/x.png' }), { status: 200 })
  })

  const client = createKon10Client()
  const file = new File([new Uint8Array([1])], 'x.png', { type: 'image/png' })
  const doc = await client.upload(file, { alt: 'A cat' })

  assert.equal(doc.id, 'm1')
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/__kon10\/upload$/)
  const form = calls[0].body as FormData
  assert.ok(form instanceof FormData)
  assert.equal((form.get('file') as File).name, 'x.png')
  assert.equal(form.get('alt'), 'A cat')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kon10/admin-sdk exec tsc -p tsconfig.json && node --test packages/admin-sdk/dist/client/client.upload.test.js`
Expected: FAIL — `client.upload is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/admin-sdk/src/client/client.ts
import { DEFAULT_RPC_PATH, DEFAULT_UPLOAD_PATH } from './default-rpc.js'
// ... existing imports

export interface Kon10Client {
  // ... existing methods
  /** Upload a file via the dedicated multipart route (not the JSON RPC path). */
  upload(file: File, extra?: Record<string, string>): Promise<JsonDoc>
}

async function fetchUpload(
  endpoint: string,
  file: File,
  extra?: Record<string, string>,
): Promise<JsonDoc> {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(extra ?? {})) form.append(k, v)
  const res = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', body: form })
  if (!res.ok) throw new Error(`Kon10 upload failed (${res.status} ${res.statusText})`)
  return res.json() as Promise<JsonDoc>
}

export function createKon10Client(source: Kon10ServerFn | Kon10ClientOptions = {}): Kon10Client {
  const serverFn = typeof source === 'function' ? source : source.serverFn
  const endpoint = typeof source === 'function' ? DEFAULT_RPC_PATH : source.endpoint ?? DEFAULT_RPC_PATH

  // ... existing `call` + returned object, plus:
  return {
    // ... existing methods
    upload: (file, extra) => {
      if (serverFn) {
        throw new Error('client.upload() requires the default fetch transport (no custom serverFn support yet).')
      }
      return fetchUpload(DEFAULT_UPLOAD_PATH, file, extra)
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kon10/admin-sdk exec tsc -p tsconfig.json && node --test packages/admin-sdk/dist/client/client.upload.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/admin-sdk/src/client/client.ts packages/admin-sdk/src/client/client.upload.test.js
git commit -m "feat(admin-sdk): Kon10Client.upload() over the dedicated upload route"
```

---

### Task 7: `@kon10/media/admin` — upload/picker field renderer

Ships the field renderer as a module admin-UI extension, the same
`admin.ui` barrel contract `@kon10/auth` uses. The generic collection
list/edit view already covers a "media library" for free (`media` is a
plain `Collection`-shaped entity) — a bespoke grid/masonry library page is
UX polish, deferred to Phase 3, not built here.

**Files:**
- Create: `packages/modules/media/src/admin/fields/media-field.tsx`
- Create: `packages/modules/media/src/admin/index.ts`
- Create: `packages/modules/media/tsconfig.admin.json`
- Modify: `packages/modules/media/tsconfig.json` (already excludes `src/admin`, from Task 2)
- Modify: `packages/modules/media/package.json` (`./admin` export, build script, peer/dev deps)
- Modify: `packages/modules/media/src/module.ts` (`admin.ui`)

**Interfaces:**
- Consumes: `useKon10`, `useAsync`, `type JsonDoc` from `@kon10/start`; `type FieldControlProps`, `humanize` from `@kon10/admin-sdk`; UI primitives from `@kon10/ui`.
- Produces: `@kon10/media/admin` exports `adminExtensions: AdminExtensions` with one `fields` entry for `type: 'media'`.

- [ ] **Step 0: Confirm `@kon10/ui` primitive names**

Run: `grep -n "^export" packages/ui/src/index.ts` — confirm the exact
`Button`/`Field` (and any spinner/loading primitive) export names before
writing the JSX below; adjust prop names to match if they differ from the
sketch here (mirror `RelationshipField.tsx`'s usage as the reference).

- [ ] **Step 1: Field renderer**

```tsx
// packages/modules/media/src/admin/fields/media-field.tsx
/**
 * `media` field renderer — upload input + thumbnail/filename preview. Lives
 * in @kon10/media/admin (not @kon10/admin-sdk) so the SDK stays ignorant of
 * what "media" means; registered by type, same mechanism as any module field
 * renderer.
 */
import { useState } from 'react'
import { Button, Field as FieldWrap } from '@kon10/ui'
import { type FieldControlProps, humanize } from '@kon10/admin-sdk'
import { useKon10, useAsync, type JsonDoc } from '@kon10/start'

export const config = { type: 'media' }

export default function MediaField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const { client } = useKon10()
  const [busy, setBusy] = useState(false)
  const mediaId = typeof value === 'string' ? value : undefined

  const doc = useAsync<JsonDoc | null>(
    () => (mediaId ? client.get('media', mediaId) : Promise.resolve(null)),
    [mediaId],
  )

  const label = field.meta?.label ?? humanize(field.name)

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setBusy(true)
    try {
      const created = await client.upload(file)
      onChange(created.id)
    } finally {
      setBusy(false)
      onBlur()
    }
  }

  return (
    <FieldWrap
      htmlFor={id}
      label={label}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      {doc.data?.url ? (
        <div className="flex items-center gap-3">
          {typeof doc.data.mimeType === 'string' && doc.data.mimeType.startsWith('image/') ? (
            <img
              src={String(doc.data.url)}
              alt={String(doc.data.alt ?? '')}
              className="h-16 w-16 rounded-md object-cover"
            />
          ) : (
            <span className="text-small">{String(doc.data.filename)}</span>
          )}
          <Button type="button" variant="ghost" onClick={() => onChange(undefined)}>
            Remove
          </Button>
        </div>
      ) : (
        <input
          id={id}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files)}
          onBlur={onBlur}
        />
      )}
    </FieldWrap>
  )
}
```

- [ ] **Step 2: Barrel**

```ts
// packages/modules/media/src/admin/index.ts
import { collectAdminExtensions, type AdminExtensions } from '@kon10/admin-sdk'

export const adminExtensions: AdminExtensions = collectAdminExtensions({
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
})
```

- [ ] **Step 3: `admin.ui` on the module**

```ts
// packages/modules/media/src/module.ts — update the returned Module
    admin: { nav: { label: 'Media', order: 25 }, ui: '@kon10/media/admin' },
```

- [ ] **Step 4: Split builds + package export** (identical pattern to `@kon10/auth`, see `docs/superpowers/plans/2026-06-25-module-admin-ui-contract.md` Task 4, Steps 4-5)

```jsonc
// packages/modules/media/tsconfig.admin.json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "composite": true
  },
  "references": [
    { "path": "../../core" },
    { "path": "../../admin-sdk" },
    { "path": "../../ui" },
    { "path": "../../start" }
  ],
  "include": ["src/admin/**/*.ts", "src/admin/**/*.tsx"],
  "exclude": ["dist", "node_modules"]
}
```

```jsonc
// packages/modules/media/package.json — add the ./admin export + deps
  "exports": {
    ".": { "types": "./dist/index.d.ts", "development": "./src/index.ts", "import": "./dist/index.js" },
    "./admin": { "types": "./dist/admin/index.d.ts", "development": "./src/admin/index.ts", "import": "./dist/admin/index.js" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.admin.json",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.admin.json --noEmit",
    "test": "tsc -p tsconfig.json && node --test dist/"
  },
  "peerDependencies": {
    "@kon10/core": "workspace:*",
    "@kon10/admin-sdk": "workspace:*",
    "@kon10/start": "workspace:*",
    "@kon10/ui": "workspace:*",
    "react": "^18 || ^19"
  },
  "peerDependenciesMeta": {
    "@kon10/admin-sdk": { "optional": true },
    "@kon10/start": { "optional": true },
    "@kon10/ui": { "optional": true },
    "react": { "optional": true }
  },
  "devDependencies": {
    "@kon10/admin-sdk": "workspace:*",
    "@kon10/start": "workspace:*",
    "@kon10/ui": "workspace:*",
    "@types/react": "^19.0.0",
    "react": "^19.0.0"
  }
```

- [ ] **Step 5: Install, build, verify server entry stayed React-free**

Run: `pnpm install && pnpm --filter @kon10/media build`
Run: `grep -REl "react|@kon10/ui|@kon10/admin-sdk|@kon10/start" packages/modules/media/dist/index.js packages/modules/media/dist/module.js packages/modules/media/dist/entities.js packages/modules/media/dist/builders.js 2>/dev/null || echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 6: Commit**

```bash
git add packages/modules/media/src/admin packages/modules/media/tsconfig.admin.json packages/modules/media/package.json packages/modules/media/src/module.ts pnpm-lock.yaml
git commit -m "feat(media): ship the media field renderer as @kon10/media/admin"
```

---

### Task 8: Wire into the playground + end-to-end smoke test

**Files:**
- Modify: `apps/playground/kon10.config.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-7.

- [ ] **Step 1: Add the module + storage adapter + a `featuredImage` field**

```ts
// apps/playground/kon10.config.ts
import { localDiskStorage, media, MediaModule } from '@kon10/media'
// ... existing imports

export default defineConfig({
  db: tursoAdapter({ /* unchanged */ }),
  storage: localDiskStorage({ dir: './public/uploads', publicPath: '/uploads' }),

  modules: [
    UsersModule(),
    AuthModule({ /* unchanged */ }),
    MediaModule(),

    ContentModule({
      entities: [
        // ...
        Collection({
          slug: 'posts',
          // ... unchanged
          fields: {
            title: text({ required: true }),
            slug: text({ unique: true }),
            content: richtext(),
            featuredImage: media(),
            status: select({ /* unchanged */ }),
            views: number({ integer: true, defaultValue: 0 }),
          },
        }),
        // ...
      ],
    }),
  ],
  // seed unchanged
})
```

- [ ] **Step 2: Workspace typecheck**

Run: `pnpm -w typecheck`
Expected: PASS across all packages (core, admin-sdk, start, media incl. `tsconfig.admin.json`, playground).

- [ ] **Step 3: Build the affected packages**

Run: `pnpm --filter @kon10/core --filter @kon10/admin-sdk --filter @kon10/media --filter @kon10/start build`
Expected: PASS; `packages/modules/media/dist/admin/index.js` present.

- [ ] **Step 4: Manual smoke (dev server)**

Run: `pnpm --filter playground dev` (background), log in as the seeded admin, open a `posts` document.
Expected:
- The **Featured Image** field renders a file input.
- Choosing an image file uploads it (`POST /__kon10/upload`), the field switches to a thumbnail preview, and the file appears under `apps/playground/public/uploads/`.
- Saving the post persists the `featuredImage` id; reopening the post shows the same thumbnail.
- `/admin/content/media` lists the uploaded row (generic collection list view).
Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/kon10.config.ts apps/playground/.gitignore
git commit -m "feat(playground): wire MediaModule + a posts.featuredImage field"
```

> Note: add `public/uploads/` to `apps/playground/.gitignore` if it isn't
> already covered, so locally-uploaded dev files don't get committed.

---

### Task 9: Full workspace verification

- [ ] **Step 1:** `pnpm -w typecheck` — PASS.
- [ ] **Step 2:** `pnpm -w test` — PASS (every `node --test` suite added above, plus existing suites unaffected).
- [ ] **Step 3:** `pnpm -w build` — PASS.
- [ ] **Step 4:** Re-run the Task 8 Step 4 manual smoke once more against a clean `pnpm install` to catch anything only a fresh checkout would expose.

---

## Self-Review

**Spec coverage (against the Phase 0 scope in the roadmap doc):**
- "`media` entity (`Collection`, cardinality `many`)" → Task 3 (`buildMediaEntity`). ✓
- "`media` field type, dedicated rather than reusing `relationship`" → Task 3 (`media()` builder + registered type), rationale restated in Global Constraints. ✓
- "`StorageAdapter` contract + local-disk implementation" → Task 1 (wire the already-declared core contract) + Task 2 (local-disk impl). ✓
- "Dedicated `/__kon10/upload` file route, not base64-through-RPC" → Task 5. ✓
- "Upload route runs the same guard/RBAC check as `media.create`" (the roadmap's remaining open risk) → Task 5: `dispatchKon10Upload` calls `operations.create` under `context.enforce: true`, which the existing RBAC guard (`packages/modules/auth/src/rbac/guard.ts`) enforces identically to the RPC `create` action — resolved, not worked around. ✓
- "`@kon10/media/admin` ships the upload dropzone + picker field renderer" → Task 7. ✓ (Library grid view explicitly deferred to Phase 3, noted in Task 7's intro — not silently dropped.)
- "Unblocks `posts.featuredImage`" → Task 8. ✓

**Architecture conformance:**
- Module-first/extension-first split honored: Tasks 1-6 are server-only (core + media + start transport), Task 7 is the only client-aware piece and goes through the `admin.ui` barrel — no new surface added to `@kon10/admin-sdk` core itself. ✓
- No `@kon10/content` import from `@kon10/media` (Global Constraints + Task 3 comment). ✓
- `@kon10/media`'s main entry stays React-free (Task 7 Step 5 grep guard, mirroring the auth plan's Task 4 Step 7). ✓

**Placeholder scan:** no TBD/TODO; Task 7 Step 0 is the one explicitly-flagged "confirm before writing" step, and it names exactly what to check and where. Every other step shows full code with an expected pass/fail outcome.

**Type consistency:** `StorageAdapter.upload(file: File): Promise<{ url, key }>` (existing core type) is the shape `localDiskStorage` (Task 2) implements and `dispatchKon10Upload` (Task 5) calls; `media()`'s stored value (`string`, the media doc id) is what `MediaField` (Task 7) reads/writes via `onChange`/`client.get('media', id)`; `Kon10Client.upload()` (Task 6) returns the same `JsonDoc` shape `client.get`/`client.create` already return elsewhere in the SDK.

**Known follow-ups (intentionally out of scope here, not oversights):**
- The generic collection form lets someone hand-edit `filename`/`url`/`mimeType` on a `media` doc after upload (no read-only field support exists yet). Acceptable for Phase 0; worth a small admin-sdk enhancement later.
- R2/S3 `StorageAdapter` for production/serverless deploys (SPEC.md's original target) is a separate fast-follow, not blocked by anything here.
- A masonry/grid media library page is Phase 3 UX polish, not Phase 0.

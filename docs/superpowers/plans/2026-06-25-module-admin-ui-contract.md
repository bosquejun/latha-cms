# Module Admin-UI Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a LathaCMS module ship its own admin UI through the same folder convention an app uses, discovered automatically from `latha.config`, and migrate the auth `RolesPermissions` screen out of `@latha/start` as the first consumer.

**Architecture:** A module declares a serializable client-entrypoint string (`admin.ui`) on its server `Module` object. The `@latha/start` Vite plugin evaluates `latha.config` at build time, reads those strings, and statically imports each module's `./admin` barrel — merging module-contributed extensions with the app's own `src/admin/` folder (app wins on conflict) into the existing `AdminExtensions` registry. A new shared `collectAdminExtensions` helper in `@latha/admin-sdk` holds the glob-assembly logic so apps, module barrels, and the plugin all share one implementation.

**Tech Stack:** TypeScript (NodeNext), React 19, TanStack Start + Vite, pnpm workspaces, `node:test`.

## Global Constraints

- `@latha/start/src` must contain **no** auth-domain code — no references to `roles`/`scopes`/`permissions`/`admin:access`/superadmin matrix logic. (Verified by grep in the final task.)
- `@latha/auth`'s **main** entry (`dist/index.js`) must stay server-only: it imports only `@latha/core` and Node built-ins, never React / `@latha/ui` / `@latha/admin-sdk` / `@latha/start`. Client deps live solely behind the `./admin` subpath.
- `RelationshipField.tsx` stays in `@latha/start` (generic core field renderer). Do not move it.
- Module admin UI imports framework symbols only from **public** entrypoints (`@latha/start`, `@latha/admin-sdk`, `@latha/ui`), never start-internal `../context.js` / `../hooks.js`.
- The server route keeps reaching the config through the existing `virtual:latha/config` re-export — do not change that path.
- Build-time config evaluation reads `modules[].admin.ui` only; it must never bootstrap an instance or run `onInit`/`onReady`/`seed`.
- TDD, DRY, YAGNI, frequent commits. Run `pnpm -w typecheck` before any "done" claim.

---

### Task 1: `collectAdminExtensions` + `mergeExtensions` in `@latha/admin-sdk`

Extract the glob-assembly logic (currently string-templated inside the Start Vite plugin) into a shared, unit-tested helper, plus an app-over-module merge helper.

**Files:**
- Create: `packages/admin-sdk/src/extensions/collect.ts`
- Create: `packages/admin-sdk/src/extensions/collect.test.ts`
- Modify: `packages/admin-sdk/src/extensions/index.ts` (export the new helpers)
- Modify: `packages/admin-sdk/src/index.ts` (re-export at package root)

**Interfaces:**
- Consumes: `AdminExtensions`, and the per-surface extension types from `./types.js`.
- Produces:
  - `type GlobMap = Record<string, unknown>` (a module record map, e.g. from `import.meta.glob(..., { eager: true })`; each value is `{ default?: unknown; config?: unknown }`).
  - `interface AdminGlobs { widgets?: GlobMap; pages?: GlobMap; dashboard?: GlobMap; settings?: GlobMap; fields?: GlobMap }`
  - `function collectAdminExtensions(globs: AdminGlobs): AdminExtensions` — assembles the same shape the old `buildModuleSource` produced (filters each surface by its required config keys, sets `id` from the sorted glob key).
  - `function mergeExtensions(sources: AdminExtensions[]): AdminExtensions` — concatenates each surface array in order, then de-dups so **later sources win** per key (`path` for pages/settings, `type` for fields, `id` for widgets/dashboardWidgets, `href` for nav).

- [ ] **Step 1: Write the failing test**

```ts
// packages/admin-sdk/src/extensions/collect.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectAdminExtensions, mergeExtensions } from './collect.js'

const Comp = () => null

test('collectAdminExtensions assembles settings + fields from glob maps', () => {
  const ext = collectAdminExtensions({
    settings: {
      '/a/settings/roles.tsx': { default: Comp, config: { path: 'roles', label: 'Roles' } },
      '/a/settings/skip.tsx': { default: Comp }, // no config -> dropped
    },
    fields: {
      '/a/fields/rel.tsx': { default: Comp, config: { type: 'relationship' } },
    },
  })
  assert.equal(ext.settings?.length, 1)
  assert.equal(ext.settings?.[0].path, 'roles')
  assert.equal(ext.settings?.[0].id, '/a/settings/roles.tsx')
  assert.equal(ext.fields?.length, 1)
  assert.equal(ext.fields?.[0].type, 'relationship')
  assert.equal(ext.fields?.[0].renderer, Comp)
})

test('mergeExtensions lets later sources override by key', () => {
  const moduleExt = { settings: [{ path: 'roles', label: 'Module Roles', Component: Comp }] }
  const appExt = { settings: [{ path: 'roles', label: 'App Roles', Component: Comp }] }
  const merged = mergeExtensions([moduleExt, appExt])
  assert.equal(merged.settings?.length, 1)
  assert.equal(merged.settings?.[0].label, 'App Roles') // app wins
})

test('mergeExtensions concatenates distinct keys', () => {
  const merged = mergeExtensions([
    { fields: [{ type: 'relationship', renderer: Comp }] },
    { fields: [{ type: 'richtext', renderer: Comp }] },
  ])
  assert.equal(merged.fields?.length, 2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @latha/admin-sdk exec tsc -p tsconfig.json && node --test packages/admin-sdk/dist/extensions/collect.test.js`
Expected: FAIL — `collect.js` does not exist / `collectAdminExtensions is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/admin-sdk/src/extensions/collect.ts
/**
 * Shared admin-extension assembly. Turns convention-folder glob maps (from
 * `import.meta.glob(..., { eager: true })`) into a typed `AdminExtensions`,
 * and merges several `AdminExtensions` with later-source-wins precedence.
 * Used by the app folder scan, module `./admin` barrels, and the Start Vite
 * plugin — one implementation, no duplication.
 */
import type {
  AdminExtensions,
  DashboardWidgetExtension,
  FieldRendererExtension,
  PageExtension,
  SettingsPageExtension,
  WidgetExtension,
} from './types.js'

export type GlobMap = Record<string, { default?: unknown; config?: unknown }>

export interface AdminGlobs {
  widgets?: GlobMap
  pages?: GlobMap
  dashboard?: GlobMap
  settings?: GlobMap
  fields?: GlobMap
}

const entries = (map: GlobMap = {}) =>
  Object.keys(map)
    .sort()
    .map((id) => ({ id, mod: map[id] }))

const cfg = (mod: { config?: unknown }) =>
  (mod.config ?? {}) as Record<string, unknown>

export function collectAdminExtensions(globs: AdminGlobs): AdminExtensions {
  const widgets = entries(globs.widgets)
    .filter(({ mod }) => mod.default && cfg(mod).zone)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...cfg(mod) })) as WidgetExtension[]

  const pages = entries(globs.pages)
    .filter(({ mod }) => mod.default && cfg(mod).path)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...cfg(mod) })) as PageExtension[]

  const dashboardWidgets = entries(globs.dashboard)
    .filter(({ mod }) => mod.default)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...cfg(mod) })) as DashboardWidgetExtension[]

  const settings = entries(globs.settings)
    .filter(({ mod }) => mod.default && cfg(mod).path)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...cfg(mod) })) as SettingsPageExtension[]

  const fields = entries(globs.fields)
    .filter(({ mod }) => mod.default && cfg(mod).type)
    .map(({ mod }) => ({ type: cfg(mod).type, renderer: mod.default })) as FieldRendererExtension[]

  return { widgets, pages, dashboardWidgets, settings, fields }
}

const dedupeBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const map = new Map<string, T>()
  for (const item of items) map.set(key(item), item) // later wins
  return [...map.values()]
}

export function mergeExtensions(sources: AdminExtensions[]): AdminExtensions {
  const all = <K extends keyof AdminExtensions>(k: K) =>
    sources.flatMap((s) => s[k] ?? []) as NonNullable<AdminExtensions[K]>
  return {
    widgets: dedupeBy(all('widgets'), (w) => w.id ?? JSON.stringify(w.zone)),
    pages: dedupeBy(all('pages'), (p) => p.path),
    dashboardWidgets: dedupeBy(all('dashboardWidgets'), (d) => d.id ?? ''),
    settings: dedupeBy(all('settings'), (s) => s.path),
    fields: dedupeBy(all('fields'), (f) => f.type),
    nav: dedupeBy(all('nav'), (n) => n.href),
  }
}
```

```ts
// packages/admin-sdk/src/extensions/index.ts — append
export {
  collectAdminExtensions,
  mergeExtensions,
  type GlobMap,
  type AdminGlobs,
} from './collect.js'
```

```ts
// packages/admin-sdk/src/index.ts — add to the existing extensions re-export block
//   (the block that already lists createExtensionRegistry, EMPTY_REGISTRY, etc.)
  collectAdminExtensions,
  mergeExtensions,
  type GlobMap,
  type AdminGlobs,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @latha/admin-sdk exec tsc -p tsconfig.json && node --test packages/admin-sdk/dist/extensions/collect.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/admin-sdk/src/extensions/collect.ts packages/admin-sdk/src/extensions/collect.test.ts packages/admin-sdk/src/extensions/index.ts packages/admin-sdk/src/index.ts
git commit -m "feat(admin-sdk): shared collectAdminExtensions + mergeExtensions"
```

---

### Task 2: Add `ui` to `ModuleAdminConfig` in `@latha/core`

The only core change: a serializable string pointer to a module's admin barrel.

**Files:**
- Modify: `packages/core/src/types/config.ts:56-59` (`ModuleAdminConfig`)
- Test: `packages/core/src/types/config.admin-ui.test.ts` (type-level smoke)

**Interfaces:**
- Produces: `ModuleAdminConfig.ui?: string`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/types/config.admin-ui.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Module } from './config.js'

test('Module.admin accepts a ui specifier string', () => {
  const m: Module = { name: 'auth', admin: { ui: '@latha/auth/admin' } }
  assert.equal(m.admin?.ui, '@latha/auth/admin')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @latha/core exec tsc -p tsconfig.json --noEmit`
Expected: FAIL — TS2353 "Object literal may only specify known properties, and 'ui' does not exist in type 'ModuleAdminConfig'".

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/types/config.ts — replace the ModuleAdminConfig interface
export interface ModuleAdminConfig {
  /** Default sidebar section for this module's entities. */
  nav?: ModuleNavConfig
  /**
   * Bare import specifier for this module's admin-UI barrel (e.g.
   * '@latha/auth/admin'). The Start Vite plugin statically imports and merges
   * it into the admin extension registry at build time. A serializable string —
   * never a component. Omit for backend-only modules.
   */
  ui?: string
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @latha/core exec tsc -p tsconfig.json && node --test packages/core/dist/types/config.admin-ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types/config.ts packages/core/src/types/config.admin-ui.test.ts
git commit -m "feat(core): Module.admin.ui specifier for module admin-UI barrels"
```

---

### Task 3: Export `useAsync` from `@latha/start` public surface

Module UI needs `useAsync` from a public entrypoint. `JsonDoc` and `useLatha` are already public; this adds `useAsync`.

**Files:**
- Modify: `packages/start/src/index.ts` (add export)
- Test: `packages/start/src/public-surface.test.ts`

**Interfaces:**
- Consumes: `useAsync`, `AsyncState` from `./hooks.js` (existing).
- Produces: `@latha/start` re-exports `useAsync` and `type AsyncState`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/start/src/public-surface.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as start from './index.js'

test('@latha/start re-exports useAsync', () => {
  assert.equal(typeof start.useAsync, 'function')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @latha/start exec tsc -p tsconfig.json && node --test packages/start/dist/public-surface.test.js`
Expected: FAIL — `start.useAsync` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/start/src/index.ts — add near the other re-exports
export { useAsync, type AsyncState } from './hooks.js'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @latha/start exec tsc -p tsconfig.json && node --test packages/start/dist/public-surface.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/start/src/index.ts packages/start/src/public-surface.test.ts
git commit -m "feat(start): export useAsync from the public surface for module UI"
```

---

### Task 4: Create the auth admin-UI folder + barrel + `./admin` export

Move `RolesPermissions` into `@latha/auth`'s new client folder, register it as a settings extension, expose `@latha/auth/admin`, and keep the server entry React-free via a separate client build.

**Files:**
- Create: `packages/modules/auth/src/admin/settings/roles-permissions.tsx` (migrated from `packages/start/src/settings/RolesPermissions.tsx`)
- Create: `packages/modules/auth/src/admin/index.ts` (barrel)
- Create: `packages/modules/auth/tsconfig.admin.json` (client build → `dist/admin/`)
- Modify: `packages/modules/auth/tsconfig.json` (exclude `src/admin/**` from the server build)
- Modify: `packages/modules/auth/package.json` (`./admin` export, build script, peer/dev deps)
- Modify: `packages/modules/auth/src/module.ts` (add `admin.ui`)

**Interfaces:**
- Consumes: `useLatha`, `useAsync`, `type JsonDoc` from `@latha/start`; `PageHeader`, `defineSettingsConfig`, `collectAdminExtensions` from `@latha/admin-sdk`; UI primitives from `@latha/ui`; icons from `lucide-react`.
- Produces: `@latha/auth/admin` default-exports nothing; named-exports `adminExtensions: AdminExtensions`. The settings file default-exports the `RolesPermissions` component and named-exports `config` (a `SettingsPageConfig` via `defineSettingsConfig`).

- [ ] **Step 1: Create the migrated settings component**

Copy the full body of `packages/start/src/settings/RolesPermissions.tsx` into `packages/modules/auth/src/admin/settings/roles-permissions.tsx` with these exact changes:
- Update the file header comment to note it lives in `@latha/auth` and is registered as a settings extension.
- Replace the two start-internal imports:

```ts
// REMOVE:
//   import { useLatha } from '../context.js'
//   import { useAsync } from '../hooks.js'
//   import type { JsonDoc } from '../rpc.js'
// ADD:
import { useLatha, useAsync, type JsonDoc } from '@latha/start'
```

- Keep `import { PageHeader } from '@latha/admin-sdk'` but add the config helper:

```ts
import { PageHeader, defineSettingsConfig } from '@latha/admin-sdk'
import { ChevronDown, Plus, ShieldCheck, Trash2 } from 'lucide-react'
```

- Add the settings config export and make the component the default export. Change the existing `export function RolesPermissions()` to `export default function RolesPermissions()`, and add above it:

```ts
export const config = defineSettingsConfig({
  path: 'roles',
  label: 'Roles & Permissions',
  description: 'Define what each role can do across every module.',
  icon: ShieldCheck,
})
```

- Everything else (the matrix logic, `ToggleRow`, the `@latha/ui` imports) is copied verbatim.

- [ ] **Step 2: Create the barrel**

```ts
// packages/modules/auth/src/admin/index.ts
/**
 * @latha/auth/admin — the auth module's admin-UI barrel.
 *
 * Collects this module's `src/admin/**` convention folders (same shape an app
 * uses under its own `src/admin/`) into a single `AdminExtensions`, which the
 * Start Vite plugin merges into the admin registry when `@latha/auth` is present
 * in `latha.config`. Client-only — never imported by the server entry.
 */
import { collectAdminExtensions, type AdminExtensions } from '@latha/admin-sdk'

export const adminExtensions: AdminExtensions = collectAdminExtensions({
  widgets: import.meta.glob('./widgets/**/*.{tsx,jsx,ts,js}', { eager: true }),
  pages: import.meta.glob('./pages/**/*.{tsx,jsx,ts,js}', { eager: true }),
  dashboard: import.meta.glob('./dashboard/**/*.{tsx,jsx,ts,js}', { eager: true }),
  settings: import.meta.glob('./settings/**/*.{tsx,jsx,ts,js}', { eager: true }),
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
})
```

- [ ] **Step 3: Add `admin.ui` to the module**

```ts
// packages/modules/auth/src/module.ts — update the admin field in the returned Module
    admin: { nav: { area: 'settings', label: 'Access', order: 90 }, ui: '@latha/auth/admin' },
```

- [ ] **Step 4: Split the TypeScript builds (server stays React-free)**

Modify `packages/modules/auth/tsconfig.json` so the server build never compiles the client folder:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "composite": true
  },
  "references": [{ "path": "../../core" }],
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "src/admin"]
}
```

Create `packages/modules/auth/tsconfig.admin.json` for the client build:

```json
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

> Note: `"types": ["vite/client"]` gives `import.meta.glob` its type. If `vite/client` is not resolvable from this package, add a one-line ambient declaration `packages/modules/auth/src/admin/vite-env.d.ts` containing `/// <reference types="vite/client" />` instead and drop the `types` field.

- [ ] **Step 5: Wire `package.json` (export + build + deps)**

```jsonc
// packages/modules/auth/package.json
{
  "name": "@latha/auth",
  "version": "0.0.0",
  "description": "LathaCMS auth — session-based authentication, password hashing, AuthModule, and admin UI.",
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./src/index.ts",
      "import": "./dist/index.js"
    },
    "./admin": {
      "types": "./dist/admin/index.d.ts",
      "development": "./src/admin/index.ts",
      "import": "./dist/admin/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.admin.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.admin.json --noEmit",
    "test": "tsc -p tsconfig.json && node --test dist/"
  },
  "peerDependencies": {
    "@latha/core": "workspace:*",
    "@latha/admin-sdk": "workspace:*",
    "@latha/start": "workspace:*",
    "@latha/ui": "workspace:*",
    "react": "^18 || ^19",
    "lucide-react": "^0.469.0"
  },
  "peerDependenciesMeta": {
    "@latha/admin-sdk": { "optional": true },
    "@latha/start": { "optional": true },
    "@latha/ui": { "optional": true },
    "react": { "optional": true },
    "lucide-react": { "optional": true }
  },
  "devDependencies": {
    "@latha/core": "workspace:*",
    "@latha/admin-sdk": "workspace:*",
    "@latha/start": "workspace:*",
    "@latha/ui": "workspace:*",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "react": "^19.0.0",
    "lucide-react": "^0.469.0",
    "typescript": "^5.7.2"
  }
}
```

> The client deps are `optional` peers so backend-only consumers of `@latha/auth` (server entry) install nothing extra; only apps that pull `@latha/auth/admin` provide them (they already do via `@latha/start`).

- [ ] **Step 6: Install + build the package**

Run: `pnpm install`
Then: `pnpm --filter @latha/auth build`
Expected: both `tsc` invocations succeed; `packages/modules/auth/dist/admin/index.js` and `dist/admin/settings/roles-permissions.js` exist; `dist/index.js` (server) still imports only `@latha/core` (verify next step).

- [ ] **Step 7: Verify server entry stayed React-free**

Run: `grep -REl "react|@latha/ui|@latha/admin-sdk|@latha/start" packages/modules/auth/dist/index.js packages/modules/auth/dist/module.js packages/modules/auth/dist/rbac 2>/dev/null || echo CLEAN`
Expected: `CLEAN` (no client imports leaked into the server build).

- [ ] **Step 8: Commit**

```bash
git add packages/modules/auth/src/admin packages/modules/auth/tsconfig.json packages/modules/auth/tsconfig.admin.json packages/modules/auth/package.json packages/modules/auth/src/module.ts pnpm-lock.yaml
git commit -m "feat(auth): ship RolesPermissions as @latha/auth/admin module UI"
```

---

### Task 5: Extend the Start Vite plugin to discover + merge module UI

Evaluate `latha.config` at build, collect `modules[].admin.ui` specifiers, and generate `virtual:latha/admin-extensions` that statically imports each module barrel and merges it with the app's own `src/admin/` glob — via the shared helpers from Task 1.

**Files:**
- Modify: `packages/start/src/vite.ts` (`adminExtensionsPlugin`, `buildModuleSource`)
- Test: `packages/start/src/vite.admin-extensions.test.ts`

**Interfaces:**
- Consumes: `collectAdminExtensions`, `mergeExtensions` from `@latha/admin-sdk` (referenced inside the generated module source, not imported by the plugin itself); a function to read module UI specifiers from the config.
- Produces:
  - `async function readModuleUiSpecifiers(load: (id: string) => Promise<unknown>, configPath: string): Promise<string[]>` — loads the config module, reads `default.modules[].admin?.ui`, returns the de-duped string list (order preserved).
  - Updated `adminExtensionsPlugin(dir, configPath)` signature; updated `buildModuleSource(base, specifiers)` that emits the merged virtual module.

- [ ] **Step 1: Write the failing test (specifier reader + module source)**

```ts
// packages/start/src/vite.admin-extensions.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readModuleUiSpecifiers, buildModuleSource } from './vite.js'

test('readModuleUiSpecifiers extracts and de-dupes module admin.ui strings', async () => {
  const fakeLoad = async () => ({
    default: {
      modules: [
        { name: 'users' },
        { name: 'auth', admin: { ui: '@latha/auth/admin' } },
        { name: 'auth2', admin: { ui: '@latha/auth/admin' } }, // dup
        { name: 'content', admin: { nav: { area: 'main' } } }, // no ui
      ],
    },
  })
  const specs = await readModuleUiSpecifiers(fakeLoad, 'virtual:latha/config')
  assert.deepEqual(specs, ['@latha/auth/admin'])
})

test('buildModuleSource imports each specifier and merges with the app glob', () => {
  const src = buildModuleSource('/src/admin', ['@latha/auth/admin'])
  assert.match(src, /from '@latha\/auth\/admin'/)
  assert.match(src, /import\.meta\.glob\('\/src\/admin\/settings/)
  assert.match(src, /mergeExtensions/)
  assert.match(src, /collectAdminExtensions/)
  assert.match(src, /export const adminExtensions/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @latha/start exec tsc -p tsconfig.json && node --test packages/start/dist/vite.admin-extensions.test.js`
Expected: FAIL — `readModuleUiSpecifiers` not exported.

- [ ] **Step 3: Implement in `vite.ts`**

Add the exported reader:

```ts
// packages/start/src/vite.ts — add near adminExtensionsPlugin
interface ModuleLike { admin?: { ui?: string } }

/**
 * Load the app's `latha.config` and read each module's `admin.ui` specifier.
 * Reads static descriptor strings only — never bootstraps an instance. `load`
 * is Vite's SSR module loader (`server.ssrLoadModule`) at serve time, or a
 * direct `import()` wrapper at build time.
 */
export async function readModuleUiSpecifiers(
  load: (id: string) => Promise<unknown>,
  configPath: string,
): Promise<string[]> {
  const mod = (await load(configPath)) as { default?: { modules?: ModuleLike[] } }
  const seen = new Set<string>()
  for (const m of mod.default?.modules ?? []) {
    const ui = m.admin?.ui
    if (ui) seen.add(ui)
  }
  return [...seen]
}
```

Rewrite `buildModuleSource` to emit static imports + merge (replacing the old single-source body):

```ts
function buildModuleSource(base: string, specifiers: string[]): string {
  const glob = (kind: string) =>
    `import.meta.glob('${base}/${kind}/**/*.{tsx,jsx,ts,js}', { eager: true })`

  const moduleImports = specifiers
    .map((spec, i) => `import { adminExtensions as mod${i} } from ${JSON.stringify(spec)}`)
    .join('\n')
  const moduleList = specifiers.map((_, i) => `mod${i}`).join(', ')

  return `
import { collectAdminExtensions, mergeExtensions } from '@latha/admin-sdk'
${moduleImports}

const appExtensions = collectAdminExtensions({
  widgets: ${glob('widgets')},
  pages: ${glob('pages')},
  dashboard: ${glob('dashboard')},
  settings: ${glob('settings')},
  fields: ${glob('fields')},
})

// Modules first, app last — the app overrides module UI on key conflict.
export const adminExtensions = mergeExtensions([${moduleList ? moduleList + ', ' : ''}appExtensions])
`
}
```

Update `adminExtensionsPlugin` to take `configPath`, resolve specifiers lazily via the dev server's SSR loader, and pass them through. The plugin caches the specifier list after first `load`:

```ts
function adminExtensionsPlugin(dir: string, configPath: string): VitePluginLike {
  const base = '/' + dir.replace(/^\.?\/*/, '').replace(/\/*$/, '')
  let specifiers: string[] | null = null
  let server: { ssrLoadModule: (id: string) => Promise<unknown> } | undefined

  return {
    name: 'latha:admin-extensions',
    // Vite calls configureServer with the dev server; cache it for SSR loads.
    // (Add configureServer to VitePluginLike — see Step 4.)
    configureServer(s: { ssrLoadModule: (id: string) => Promise<unknown> }) {
      server = s
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined
      if (specifiers === null) {
        const loader =
          server?.ssrLoadModule ?? ((m: string) => import(/* @vite-ignore */ m))
        try {
          specifiers = await readModuleUiSpecifiers(loader, CONFIG_MODULE_ID)
        } catch {
          specifiers = [] // config not loadable yet (early build) — app-only
        }
      }
      return buildModuleSource(base, specifiers)
    },
  }
}
```

In `lathaStart()`, update the call site and pass `configPath`:

```ts
// in lathaStart(), where adminExtensionsPlugin is pushed:
    extra.push(adminExtensionsPlugin(options.admin?.dir ?? 'src/admin', configPath))
```

- [ ] **Step 4: Add `configureServer` + async `load` to `VitePluginLike`**

```ts
// packages/start/src/vite.ts — extend the VitePluginLike interface
interface VitePluginLike {
  name: string
  enforce?: 'pre' | 'post'
  config?: (
    config: unknown,
    env: { command: 'build' | 'serve' },
  ) => Record<string, unknown> | undefined
  configResolved?: (config: { root: string }) => void
  configureServer?: (server: { ssrLoadModule: (id: string) => Promise<unknown> }) => void
  resolveId?: (id: string, importer?: string) => string | undefined
  load?: (id: string) => string | undefined | Promise<string | undefined>
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @latha/start exec tsc -p tsconfig.json && node --test packages/start/dist/vite.admin-extensions.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/start/src/vite.ts packages/start/src/vite.admin-extensions.test.ts
git commit -m "feat(start): discover + merge module admin UI in the vite plugin"
```

---

### Task 6: Remove auth-specific content from `@latha/start`

Delete the migrated component and its hardcoded special-case; verify `start/src` is auth-free.

**Files:**
- Delete: `packages/start/src/settings/RolesPermissions.tsx`
- Modify: `packages/start/src/admin.tsx` (remove import line 50 and the `roles` special-case at ~386-388)

**Interfaces:**
- Consumes: nothing new. The `roles` entity now routes through the auth-contributed settings extension via the existing registry path (`ext.settingsFor('roles')`).

- [ ] **Step 1: Remove the import**

```ts
// packages/start/src/admin.tsx — delete this line (currently line 50)
import { RolesPermissions } from './settings/RolesPermissions.js'
```

- [ ] **Step 2: Remove the special-case in `AdminView`**

Delete this block (currently ~lines 384-388):

```ts
  // The `roles` entity is managed through the Roles & Permissions matrix rather
  // than the auto-generated list/form.
  if ('slug' in route && route.slug === 'roles' && route.view !== 'document') {
    return <RolesPermissions />
  }
```

The `switch (route.view)` immediately below becomes the first statement in `AdminView`.

- [ ] **Step 3: Delete the file**

```bash
git rm packages/start/src/settings/RolesPermissions.tsx
```

- [ ] **Step 4: Typecheck + auth-free guard**

Run: `pnpm --filter @latha/start exec tsc -p tsconfig.json --noEmit`
Expected: PASS (no unresolved `RolesPermissions`).

Run: `grep -REn "admin:access|superadmin|permission matrix|RolesPermissions|scopes" packages/start/src || echo CLEAN`
Expected: `CLEAN` — no auth-domain content remains in start. (`RelationshipField.tsx` mentions `roles.permissions`/`users.roles` only as examples in a comment; if that line matches, reword the comment to "e.g. a many-relationship field" so the guard is unambiguous, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add packages/start/src/admin.tsx
git commit -m "refactor(start): drop auth-specific RolesPermissions and its special-case"
```

---

### Task 7: Full integration — typecheck, build, and verify the playground

Prove the end-to-end path: workspace typechecks, auth's UI is discovered from the playground config, and the roles screen renders from `@latha/auth`.

**Files:**
- Modify (only if needed): `apps/playground/latha.config.ts` — no change expected (auth already present).
- Verify: `apps/playground/src/routes/__root.tsx` still consumes `adminExtensions` from `virtual:latha/admin-extensions` (unchanged).

**Interfaces:**
- Consumes: every prior task.

- [ ] **Step 1: Workspace typecheck**

Run: `pnpm -w typecheck`
Expected: PASS across all packages (core, admin-sdk, start, auth incl. `tsconfig.admin.json`, playground).

- [ ] **Step 2: Build the affected packages**

Run: `pnpm --filter @latha/core --filter @latha/admin-sdk --filter @latha/auth --filter @latha/start build`
Expected: PASS; `packages/modules/auth/dist/admin/index.js` present.

- [ ] **Step 3: Build the playground (exercises the vite plugin's config eval + merge)**

Run: `pnpm --filter playground build`
Expected: PASS. The generated `virtual:latha/admin-extensions` imports `@latha/auth/admin`; build emits no "failed to resolve '@latha/auth/admin'" error.

- [ ] **Step 4: Manual smoke (dev server)**

Run: `pnpm --filter playground dev` (background), then open `/admin/settings/roles`.
Expected:
- The "Roles & Permissions" settings page appears in the **settings sidebar** (contributed by the auth module, no app wiring).
- The matrix renders roles, the module-grouped scope rows, and the superadmin/admin-access toggles — identical to before the refactor.
- Editing + saving a role still works (RPC `roles.update`).
Stop the dev server when done.

- [ ] **Step 5: Final guard + commit**

Run: `grep -REn "admin:access|superadmin|RolesPermissions" packages/start/src || echo CLEAN`
Expected: `CLEAN`.

```bash
git add -A
git commit -m "test: verify module admin-UI contract end-to-end in playground"
```

---

## Self-Review

**Spec coverage:**
- "Remove auth content + special-case from start" → Task 6. ✓
- "One folder-based convention for app + module" → Task 1 (`collectAdminExtensions`) + Task 4 (auth uses the same shape). ✓
- "Auto-discover from config, no per-app wiring" → Task 2 (`admin.ui`) + Task 5 (config eval + merge). ✓
- "Server Module never carries components / auth stays server-only" → Task 2 (string only) + Task 4 (split build, optional client peers, Step 7 grep guard). ✓
- "Prove via settings + fields surfaces" → settings exercised in Task 4/7; fields path exercised by `collectAdminExtensions` test (Task 1) and the unchanged `RelationshipField` registration. ✓
- "RelationshipField stays in start" → Global Constraint + Task 6 leaves it untouched. ✓
- "Build-time eval reads admin.ui only, no bootstrap" → Task 5 `readModuleUiSpecifiers` reads `modules[].admin.ui` only; Global Constraint. ✓
- "app wins on conflict" → Task 1 `mergeExtensions` test; Task 5 merge order `[...modules, app]`. ✓
- "useAsync/JsonDoc from public entrypoint" → Task 3. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. The one conditional (Task 4 Step 4 `vite/client` fallback) gives the exact alternative inline. ✓

**Type consistency:** `collectAdminExtensions(globs: AdminGlobs)` and `mergeExtensions(sources: AdminExtensions[])` are used identically in Task 1, the auth barrel (Task 4), and the generated source (Task 5). `readModuleUiSpecifiers(load, configPath)` signature matches its test and call site. `ModuleAdminConfig.ui?: string` defined in Task 2 is the field read in Task 5 and set in Task 4. ✓

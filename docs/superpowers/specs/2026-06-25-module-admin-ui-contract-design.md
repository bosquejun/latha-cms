# Module Admin-UI Contract — Design

**Date:** 2026-06-25
**Status:** Approved (pending spec review)

## Problem

`@kon10/start` is meant to be the generic, CMS-agnostic TanStack Start
integration: runtime, RPC dispatcher, client, provider, and the *generic* admin
shell. It currently leaks auth-module-specific content:

- `packages/start/src/settings/RolesPermissions.tsx` — a Strapi-style
  roles/permissions matrix that knows about `roles`, `scopes`, `permissions`,
  `admin:access`, and the superadmin `*` key. This is auth-domain UI.
- `packages/start/src/admin.tsx` (lines ~386–388) — a hardcoded special-case in
  `AdminView` that intercepts the `roles` slug and renders `<RolesPermissions />`
  instead of the auto-generated list/form.

The deeper issue is not "one misplaced file." It is that **a Kon10 module
has no way to ship its own admin UI**. Modules are backend-first today
(`@kon10/auth` is server-only, its single dependency is `@kon10/core`), but a
module should be *end-to-end*: able to contribute admin components, widgets,
pages, sidebar items, settings pages, field renderers, and UI routes as a
first-class part of the module — without `@kon10/start` knowing anything about
the specific module.

`RolesPermissions` is simply the first concrete consumer of that missing
capability.

### What is NOT a leak (stays in `start`)

`packages/start/src/fields/RelationshipField.tsx` is genuinely generic:
`relationship` is a core field type used by content, users, auth, and storage,
and the renderer needs the RPC client that lives in `start`. It is *not*
module-specific. It stays where it is. (It may later move behind the same
module/app extension convention for consistency, but that is out of scope here.)

## Goals

1. Remove all auth-specific content and special-cases from `@kon10/start`.
2. Define **one consistent, folder-based customization convention** used
   identically by an app (e.g. the playground) and by a module package.
3. Let a module ship admin UI that is discovered automatically when the module
   is present in `kon10.config` — no per-app re-export wiring, no separate
   opt-in list.
4. Keep server code and client UI cleanly separated; the server `Module` object
   never carries React components (it is loaded server-side and feeds RPC as
   JSON; components can't be serialized).
5. Prove the contract end-to-end with the surfaces `RolesPermissions` actually
   needs (a **settings page** + the **relationship field renderer**), with the
   remaining surfaces using the identical file shape so they slot in later with
   no redesign.

## Non-Goals

- Migrating every surface's first real consumer now (only settings + fields are
  exercised by RolesPermissions; pages/widgets/dashboard/nav/routes are wired in
  the contract but need no migration in this pass).
- Auto-scanning `node_modules` for UI.
- Changing the RPC/runtime/server-dispatch layers.

## The Convention (one shape, two locations)

The app already customizes the admin through a folder convention that the Vite
plugin globs into `virtual:kon10/admin-extensions`:

```
apps/playground/src/admin/
  widgets/  pages/  dashboard/  settings/  fields/   (+ routes/, see below)
```

Each file uses the existing **`default export` + named `config`** contract that
the plugin's `buildModuleSource` already understands (e.g. a settings file
exports `config = defineSettingsConfig({ path, label, icon })` and a default
component).

**A module uses the exact same folder shape**, inside its own `src/`:

```
packages/modules/auth/src/
  module.ts, rbac/, service.ts, ...      (server — unchanged)
  admin/                                 (client — new)
    settings/roles-permissions.tsx
    fields/relationship.tsx              (only if a module owns one)
    index.ts                             (the "./admin" barrel)
```

So customizing the playground and authoring a module use **the same convention**:
folder + (`default`, `config`) per file. Nothing new to learn.

### Module barrel (`src/admin/index.ts`)

A module is an installed package, so the app-side Vite glob can't reach into it
across workspace/published layouts. The module therefore owns a barrel that
collects its own folder using the same glob shape and exposes a single
`AdminExtensions`-shaped object:

```ts
// packages/modules/auth/src/admin/index.ts
import { collectAdminExtensions } from '@kon10/admin-sdk'

export const adminExtensions = collectAdminExtensions({
  widgets:    import.meta.glob('./widgets/**/*.{tsx,jsx,ts,js}',    { eager: true }),
  pages:      import.meta.glob('./pages/**/*.{tsx,jsx,ts,js}',      { eager: true }),
  dashboard:  import.meta.glob('./dashboard/**/*.{tsx,jsx,ts,js}',  { eager: true }),
  settings:   import.meta.glob('./settings/**/*.{tsx,jsx,ts,js}',   { eager: true }),
  fields:     import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}',     { eager: true }),
})
```

`collectAdminExtensions` is a new, small, **shared** helper in `@kon10/admin-sdk`
that contains the exact assembly logic currently inlined as a string inside the
Vite plugin's `buildModuleSource`. Extracting it means apps and modules share one
implementation, and the plugin can emit a call to it instead of duplicating the
logic. The package's `package.json` adds an `"./admin"` export pointing at this
barrel.

## Discovery (build-time, zero app config)

The app does **not** maintain an `adminModules` list. Discovery is derived from
the modules already present in `kon10.config`, resolved at build time by the
Vite plugin.

### Module advertises its UI specifier

The server `Module` object gains an optional, **serializable string** pointing at
its admin barrel — never a component:

```ts
// packages/core/src/types/config.ts — ModuleAdminConfig
export interface ModuleAdminConfig {
  nav?: ModuleNavConfig
  /**
   * Bare import specifier for this module's admin-UI barrel (e.g.
   * '@kon10/auth/admin'). The Start Vite plugin statically imports and merges
   * it into the admin extension registry. Omit for backend-only modules.
   */
  ui?: string
}
```

```ts
// packages/modules/auth/src/module.ts
admin: { nav: { area: 'settings', label: 'Access', order: 90 }, ui: '@kon10/auth/admin' },
```

This solves the `name → package` problem: the plugin never has to guess a
package from a module's `name: 'auth'`. The module declares its own specifier.

### Vite plugin: evaluate config, emit static imports

`adminExtensionsPlugin` (in `packages/start/src/vite.ts`) is extended to:

1. Load `kon10.config` at build time via Vite's SSR module loader
   (`server.ssrLoadModule(configPath)` in `serve`; a one-off SSR-style load in
   `build`). It reads **only** `default.modules[].admin?.ui` — the static
   descriptor strings. It never bootstraps an instance and never calls
   `onInit` / `onReady` / `seed`, so no DB connection or side effect occurs.
   (Module factories like `AuthModule({...})` only return descriptors when
   called, so simply importing the config is safe.)
2. Collect the de-duplicated set of `ui` specifiers.
3. Generate `virtual:kon10/admin-extensions` so it:
   - statically imports each module specifier's `adminExtensions` export,
   - globs the **app's** own `src/admin/` folder exactly as today,
   - merges them via a shared merge step into a single `AdminExtensions` object.

Because the imports are emitted as static `import … from '<specifier>'`, the
graph stays tree-shakeable and SSR-safe; unused module UI is dropped by the
bundler when a module is absent from the config.

The config is loaded at build time only to read static descriptor strings; the
running server route still gets the config through the existing
`virtual:kon10/config` re-export (unchanged).

### Merge & precedence

The generated module merges in this order, later overriding earlier per
`(surface, key)` — where key is `path` for pages/settings, `type` for fields,
and `id`/`zone` for widgets:

1. module-contributed extensions (in module resolution order from the config),
2. the app's own `src/admin/` extensions.

So the **app always wins** over a module: an app can override `@kon10/auth`'s
`roles` settings page by adding its own `src/admin/settings/roles.tsx`. This
precedence is implemented in the shared merge helper, used by both the plugin
and (for module-internal ordering) the barrel collector.

## Surfaces covered

The contract is generic over every surface the existing `ExtensionRegistry`
already supports — `widgets`, `pages`, `dashboardWidgets`, `settings`,
`fields`, plus `nav` items. In this pass:

- **settings** — exercised by `RolesPermissions` (migrated).
- **fields** — exercised by the relationship renderer pathway (see below).
- widgets / pages / dashboard / nav — wired through the same merge but have no
  module consumer yet; they require no migration and no extra code beyond what
  the merge already handles.

### UI routes

"New UI route" is already expressed by the existing `pages` surface: a page
extension mounts on its path segment under the admin base (`admin.tsx`
`parseRoute` → `ext.pageFor(...)`). No separate route registry is introduced;
"add a UI route" == "contribute a `pages/` file." This keeps the surface count
minimal (YAGNI) while satisfying the requirement.

## Changes to `@kon10/start`

- **Delete** `src/settings/RolesPermissions.tsx`.
- **Remove** the `roles` special-case in `src/admin.tsx` `AdminView`
  (lines ~386–388) and the `RolesPermissions` import. The `roles` entity now
  routes through the standard settings extension contributed by `@kon10/auth`.
- `src/admin.tsx` keeps `registerFieldRenderer('relationship', RelationshipField)`
  — `RelationshipField` stays in `start` (generic). The relationship renderer is
  not moved into auth; auth's `fields/` folder is reserved for any genuinely
  auth-specific renderer and is otherwise empty in this pass.
- `index.ts` re-exports are unchanged except for removing anything that pointed
  at the deleted settings file (none currently exported it publicly).
- `vite.ts` gains the config-evaluation + module-merge logic described above.

## Changes to `@kon10/auth`

- Add client UI under `src/admin/`:
  - `settings/roles-permissions.tsx` — the migrated component. Imports shift
    from `../context.js` / `../hooks.js` (start-internal) to the **public**
    surfaces only. Concretely: `useKon10` is already public from `@kon10/start`;
    `JsonDoc` is already a public type export; `useAsync` is currently *not*
    exported, so this pass adds `useAsync` (and its result type) to
    `@kon10/start`'s public `index.ts`. The module UI imports `useKon10`,
    `useAsync`, and `JsonDoc` solely from `@kon10/start`.
    `config = defineSettingsConfig({ path: 'roles',
    label: 'Roles & Permissions', icon: ShieldCheck })`.
  - `index.ts` — the barrel using `collectAdminExtensions` + `import.meta.glob`.
- `package.json`:
  - add `"./admin"` export (dev → `./src/admin/index.ts`, prod → `./dist/admin/index.js`),
  - move React / `@kon10/ui` / `@kon10/admin-sdk` / `@kon10/start` to
    `peerDependencies` (+ `devDependencies`), mirroring how `start` declares
    them, so the **server** entry stays free of client deps and only consumers of
    `@kon10/auth/admin` pull them in.
- `src/module.ts`: add `admin.ui: '@kon10/auth/admin'`.
- Server code (`module.ts`, `rbac/`, `service.ts`, …) is otherwise unchanged.

## Changes to `@kon10/admin-sdk`

- Add and export `collectAdminExtensions(globs)` — the assembly logic currently
  string-templated in `start`'s `buildModuleSource`, plus a `mergeExtensions(...)`
  used by the plugin. Pure, framework-agnostic, unit-testable.

## Changes to `@kon10/core`

- Add the optional `ui?: string` field to `ModuleAdminConfig` (the only core
  change — a serializable string, no React).

## Changes to the playground

- No new wiring required: `@kon10/auth` is already in `kon10.config`, so its
  `admin.ui` is discovered automatically and the Roles & Permissions settings
  page appears. The playground's own `src/admin/` (if/when it adds files)
  continues to work and overrides module UI on conflict.

## Data flow (end state)

```
kon10.config.ts (modules: [AuthModule(), ...])
        │  (build time, SSR load — read modules[].admin.ui only)
        ▼
start/vite.ts  adminExtensionsPlugin
        │  emits virtual:kon10/admin-extensions:
        │    import { adminExtensions as authUI } from '@kon10/auth/admin'
        │    + import.meta.glob(app 'src/admin/**')
        │    → mergeExtensions([authUI, appUI])   // app wins
        ▼
__root.tsx  <Kon10Provider extensions={adminExtensions}>
        ▼
Kon10Admin → ExtensionRegistry → settings/pages/fields/widgets/nav
        ▼
'roles' settings route → auth's RolesPermissions (no special-case in start)
```

## Testing

- **Unit (`@kon10/admin-sdk`):** `collectAdminExtensions` assembles each surface
  from glob maps correctly (filters by required config keys, sorts by id);
  `mergeExtensions` applies app-over-module precedence per `(surface, key)`.
- **Unit (auth):** the migrated `RolesPermissions` exports a valid
  `defineSettingsConfig` and a default component (smoke import).
- **Plugin behavior:** a focused test that, given a fake config exposing
  `modules[].admin.ui`, the plugin emits a virtual module importing those
  specifiers and the app glob. (Mock the SSR load.)
- **Integration (playground, manual + typecheck):** `pnpm -w typecheck` passes;
  the playground builds; navigating to `/admin/settings/roles` renders the
  matrix from `@kon10/auth`; `@kon10/start` no longer imports any auth symbol
  (`grep` guard: no `roles|permissions|scopes`-specific code in `start/src`).
- **Regression:** existing auth `rbac/permissions.test.ts` still passes; server
  `@kon10/auth` entry still imports only `@kon10/core` (no React pulled into the
  server bundle).

## Risks / Open considerations

- **Build-time config evaluation.** Loading `kon10.config` in the plugin imports
  module factories. Mitigated by only *reading descriptor strings* and never
  bootstrapping; factories return plain descriptors. If a config does heavy work
  at import time (it shouldn't), that surfaces at build — acceptable and visible.
- **Dual module instance in dev.** The existing `kon10:dev-source` plugin already
  routes `@kon10/*` through the `development` condition so the whole graph shares
  one `context.tsx`. `@kon10/auth/admin` importing `useKon10` from `@kon10/start`
  must resolve to that same source copy — it will, via the existing condition.
- **Published consumers.** `@kon10/auth/admin` must ship in `dist/` and be listed
  in `files`; the `"./admin"` export's `import` path points at `dist`.

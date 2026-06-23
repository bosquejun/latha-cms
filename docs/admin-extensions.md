# Customizing the Admin UI

LathaCMS ships a config-driven admin, but every project eventually needs to bolt
something onto it — a banner, an extra page, a tweak to a form. The **admin
extension system** gives devs a structured set of *places* to attach custom
React components, in the spirit of Medusa's admin injection zones.

There are six surfaces:

| Surface | What it is | Authored in |
|---|---|---|
| **Widgets** | Components injected into named **zones** scattered through the shell and views | `src/admin/widgets/` |
| **Pages** | Full custom pages with their own sidebar entry, mounted at `/admin/<path>` | `src/admin/pages/` |
| **Dashboard widgets** | Cards dropped into the dashboard grid | `src/admin/dashboard/` |
| **Settings pages** | Pages namespaced under `/admin/settings`, with an auto-generated index | `src/admin/settings/` |
| **Field renderers** | Overrides for how a field type renders in forms | `src/admin/fields/` |
| **Nav links** | Plain sidebar links (internal or external) | `defineAdminExtensions` |

---

## How registration works

Two authoring styles, one underlying registry.

### File convention (recommended)

The `lathaStart()` Vite plugin scans `src/admin/` and assembles everything into a
single virtual module, `virtual:latha/admin-extensions`. Each file exports a
**default component** plus a **`config`** declared with a `define*Config` helper.
Wire the collected object into the provider once:

```tsx
// src/routes/__root.tsx
/// <reference types="@latha/start/virtual" />
import { LathaProvider } from '@latha/start'
import { adminExtensions } from 'virtual:latha/admin-extensions'

<LathaProvider client={latha} extensions={adminExtensions}>
  <Outlet />
</LathaProvider>
```

This mirrors how `lathaStart()` already injects the `/login` and `/admin/$`
routes: convention + Vite plugin, with an explicit fallback. Disable or relocate
the scan with `lathaStart({ admin: false })` or `lathaStart({ admin: { dir: 'src/cms' } })`.

### Explicit (no magic)

The engine is just a registry, so you can skip the convention entirely and build
the object by hand:

```tsx
import { defineAdminExtensions } from '@latha/start'
import HelpButton from './HelpButton'

export const extensions = defineAdminExtensions({
  widgets: [{ zone: 'shell.topbar.start', Component: HelpButton }],
  nav: [{ label: 'Docs', href: 'https://latha.dev', external: true }],
})
```

Both produce an `AdminExtensions` object you pass to `<LathaProvider extensions={…}>`.

---

## Injection zones

A **widget** declares one or more zones. At render, the `<Slot>` baked into that
spot renders every widget for the zone in `order`. Empty zones emit no markup.

```tsx
// src/admin/widgets/topbar-help.tsx
import { defineWidgetConfig, type WidgetContext } from '@latha/start'

export const config = defineWidgetConfig({ zone: 'shell.topbar.start' })

export default function TopbarHelp(_: WidgetContext) {
  return <a href="/docs">Help</a>
}
```

The full catalogue (`ADMIN_ZONES`):

| Zone | Renders | Context |
|---|---|---|
| `shell.topbar.start` / `shell.topbar.end` | Ends of the topbar | — |
| `shell.sidebar.top` / `shell.sidebar.bottom` | Top/bottom of the sidebar | — |
| `shell.main.before` / `shell.main.after` | Around the main content area | — |
| `dashboard.before` / `dashboard.after` | Around the dashboard | — |
| `list.before` / `list.after` | Around a collection list | `entity`, `data.rows` |
| `form.before` / `form.after` | Top/bottom of the form's main column | `entity`, `recordId` |
| `form.sidebar.before` / `form.sidebar.after` | Around the form's meta sidebar | `entity`, `recordId` |
| `document.before` / `document.after` | Around a document singleton | `entity` |

Every widget receives a `WidgetContext`: the active `zone`, plus `entity` /
`recordId` / `data` in entity-scoped zones. Bail out for entities you don't
target:

```tsx
export default function PostTips({ entity, recordId }: WidgetContext) {
  if ((entity as { slug?: string })?.slug !== 'posts') return null
  return <aside>…</aside>
}
```

---

## Custom pages

```tsx
// src/admin/pages/analytics.tsx
import { definePageConfig, type PageComponentProps } from '@latha/start'

export const config = definePageConfig({
  path: 'analytics',          // → /admin/analytics
  label: 'Analytics',         // sidebar label
  group: 'Insights',          // sidebar group heading (default "Extensions")
  // icon, hidden, order also supported
})

export default function Analytics({ params }: PageComponentProps) {
  // params = splat segments after the mount path: /admin/analytics/a/b → ['a','b']
  return <div>…</div>
}
```

Settings pages are identical but use `defineSettingsConfig` and mount under
`/admin/settings/<path>`; an index at `/admin/settings` lists them.

---

## Dashboard widgets & field renderers

```tsx
// src/admin/dashboard/welcome.tsx
import { defineDashboardWidgetConfig } from '@latha/start'
export const config = defineDashboardWidgetConfig({ span: 2 }) // 1..4 grid columns
export default function Welcome() { return <Card>…</Card> }
```

```tsx
// src/admin/fields/color.tsx — override how a field type renders in forms
import { defineFieldConfig, type FieldControlProps } from '@latha/start'
export const config = defineFieldConfig({ type: 'text' })
export default function ColorField({ value, onChange }: FieldControlProps) {
  return <input type="color" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
}
```

Field renderers are registered into the same registry the auto-generated forms
read from, so an override applies everywhere that type appears.

---

## Sidebar sections

Entity groups, custom pages, nav links, and settings all render through the same
`SidebarSection` shape, so the sidebar reads as one coherent list. Three tiers,
top to bottom:

1. **Ungrouped** (no heading) — the default. Anything without an explicit group
   floats to the top as a flat list, next to Dashboard. This keeps the sidebar
   from sprouting a heading for every single item.
2. **Named groups** (with a heading) — opt in per module via `admin.nav.label`
   (e.g. `ContentModule` → "Content"), or per entity via `admin.group`. Best for
   a module that contributes several entities.
3. **Settings** — a conventional area pinned to the bottom. Settings pages land
   here automatically; a module can join it by naming its group `Settings`
   (that's how `UsersModule` places the `users` entity there).

```ts
// A module that wants a heading for its entities:
admin: { nav: { label: 'Content', order: 10 } }

// A module that belongs in the bottom Settings area:
admin: { nav: { label: 'Settings', order: 1000 } }
```

```ts
// Pull a single entity into a named group / order it within one:
Collection({
  slug: 'posts',
  admin: { group: 'Blog', order: 1 },
  fields: { /* … */ },
})
```

Resolution per entity: `admin.group` → the module's `admin.nav.label` →
**ungrouped**. Sections sort by `admin.nav.order`; items by `admin.order`. Set
`collapsible: true` (with optional `defaultCollapsed`) on a module's nav to make
its section a collapse toggle. Custom pages are ungrouped unless they declare a
`group`; settings pages always collect under "Settings".

## Architecture notes

- The engine lives in `@latha/admin-sdk` (`src/extensions/`): the `AdminZone`
  catalogue, the `ExtensionRegistry`, the `<Slot>` primitive, and React context.
  It is component-aware and therefore **client-only** — extensions never travel
  over RPC.
- `@latha/start` wires the registry through `LathaProvider`, merges custom pages
  / nav into the sidebar, routes custom + settings pages on the admin splat, and
  applies field-renderer overrides.
- Adding a new zone is a two-line change: add the literal to `ADMIN_ZONES`, then
  drop a `<Slot zone="…" />` where it should render.

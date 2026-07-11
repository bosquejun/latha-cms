# Customizing the Studio UI

Kon10 ships a config-driven Studio, but every project eventually needs to bolt
something onto it — a banner, an extra page, a tweak to a form. The **Studio
extension system** gives devs a structured set of *places* to attach custom
React components, in the spirit of Medusa's admin injection zones.

There are seven surfaces:

| Surface | What it is | Authored in |
|---|---|---|
| **Widgets** | Components injected into named **zones** scattered through the shell and views | `src/studio/widgets/` |
| **Pages** | Full custom pages with their own nav entry, mounted at `/studio/<path>` | `src/studio/pages/` |
| **Dashboard widgets** | Cards dropped into the dashboard grid | `src/studio/dashboard/` |
| **Settings pages** | Pages namespaced under `/studio/settings`, with an auto-generated index | `src/studio/settings/` |
| **Field renderers** | Overrides for how a field type renders in forms | `src/studio/fields/` |
| **List views** | Full replacements for one entity's list view (e.g. a media grid) | `src/studio/lists/` |
| **Nav links** | Plain nav links (internal or external) | `defineStudioExtensions` |

---

## How registration works

Two authoring styles, one underlying registry.

### File convention (recommended)

The `kon10Start()` Vite plugin scans `src/studio/` and assembles everything into a
single virtual module, `virtual:kon10/studio-extensions`. Each file exports a
**default component** plus a **`config`** declared with a `define*Config` helper.
Wire the collected object into the provider once:

```tsx
// src/routes/__root.tsx
/// <reference types="@kon10/start/virtual" />
import { Kon10Provider } from '@kon10/start'
import { studioExtensions } from 'virtual:kon10/studio-extensions'

<Kon10Provider client={kon10} extensions={studioExtensions}>
  <Outlet />
</Kon10Provider>
```

This mirrors how `kon10Start()` already injects the `/login` and `/studio/$`
routes: convention + Vite plugin, with an explicit fallback. Disable or relocate
the scan with `kon10Start({ studio: false })` or `kon10Start({ studio: { dir: 'src/cms' } })`.

### Explicit (no magic)

The engine is just a registry, so you can skip the convention entirely and build
the object by hand:

```tsx
import { defineStudioExtensions } from '@kon10/start'
import HelpButton from './HelpButton'

export const extensions = defineStudioExtensions({
  widgets: [{ zone: 'shell.topbar.start', Component: HelpButton }],
  nav: [{ label: 'Docs', href: 'https://kon10.dev', external: true }],
})
```

Both produce a `StudioExtensions` object you pass to `<Kon10Provider extensions={…}>`.

---

## Injection zones

A **widget** declares one or more zones. At render, the `<Slot>` baked into that
spot renders every widget for the zone in `order`. Empty zones emit no markup.

```tsx
// src/studio/widgets/topbar-help.tsx
import { defineWidgetConfig, type WidgetContext } from '@kon10/start'

export const config = defineWidgetConfig({ zone: 'shell.topbar.start' })

export default function TopbarHelp(_: WidgetContext) {
  return <a href="/docs">Help</a>
}
```

The full catalogue (`STUDIO_ZONES`):

| Zone | Renders | Context |
|---|---|---|
| `shell.topbar.start` / `shell.topbar.end` | Ends of the top bar | — |
| `shell.sidebar.top` / `shell.sidebar.bottom` | Top/bottom of the active section's rail (only when the active tab has sub-navigation), and of the mobile menu sheet | — |
| `shell.main.before` / `shell.main.after` | Around the main content area | — |
| `dashboard.before` / `dashboard.after` | Around the dashboard | — |
| `list.before` / `list.after` | Around a collection list | `entity`, `data.rows` |
| `form.before` / `form.after` | Top/bottom of the form's main column | `entity`, `recordId` |
| `form.sidebar.before` / `form.sidebar.after` | Around the form's meta sidebar | `entity`, `recordId` |
| `global.before` / `global.after` | Around a global (single-record) entity view | `entity` |

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
// src/studio/pages/analytics.tsx
import { definePageConfig, type PageComponentProps } from '@kon10/start'

export const config = definePageConfig({
  path: 'analytics',          // → /studio/analytics
  label: 'Analytics',         // nav label
  group: 'Insights',          // join (or create) the "Insights" section; omit for a tab of its own
  // icon, hidden, order also supported
})

export default function Analytics({ params }: PageComponentProps) {
  // params = splat segments after the mount path: /studio/analytics/a/b → ['a','b']
  return <div>…</div>
}
```

Settings pages are identical but use `defineSettingsConfig` and mount under
`/studio/settings/<path>`; an index at `/studio/settings` lists them.

---

## Dashboard widgets & field renderers

```tsx
// src/studio/dashboard/welcome.tsx
import { defineDashboardWidgetConfig } from '@kon10/start'
export const config = defineDashboardWidgetConfig({ span: 2 }) // 1..4 grid columns
export default function Welcome() { return <Card>…</Card> }
```

```tsx
// src/studio/fields/color.tsx — override how a field type renders in forms
import { defineFieldConfig, type FieldControlProps } from '@kon10/start'
export const config = defineFieldConfig({ type: 'text' })
export default function ColorField({ value, onChange }: FieldControlProps) {
  return <input type="color" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
}
```

Field renderers are registered into the same registry the auto-generated forms
read from, so an override applies everywhere that type appears.

```tsx
// src/studio/lists/media.tsx — replace one entity's whole list view
import { defineEntityListConfig, type EntityListProps } from '@kon10/start'
export const config = defineEntityListConfig({ slug: 'media' })
export default function MediaGrid({ rows, getEditHref }: EntityListProps) { /* … */ }
```

List views are keyed by entity slug; the app's replacement wins over a
module-provided one (that's how you'd restyle `@kon10/media`'s grid).

---

## Navigation sections

The shell is a top-nav layout: a tab strip of top-level sections under the top
bar, with a **section rail** (a vertical sidebar of sub-items) next to the
content when the active section owns deep navigation. Entity groups, custom
pages, nav links, and settings all feed the same section model:

1. **Ungrouped** — the default. Anything without an explicit group becomes its
   own top-level tab, full-width, with no rail.
2. **Named groups** — opt in per module via `studio.nav.label` (e.g.
   `ContentModule` → "Content"), or per entity via `studio.group`. A group
   becomes one tab that links to its first item and lists all its items in a
   section rail. Best for a module that contributes several entities.
3. **Settings** — a conventional area rendered as the last tab. Settings pages
   land there automatically; an entity joins it via `studio.area: 'settings'`
   (that's how `UsersModule` places the `users` entity there — a module can set
   it for all its entities via `studio.nav.area`), and settings-area entities
   route under `/studio/settings/…`.

```ts
// A module that wants its entities grouped under one tab:
studio: { nav: { label: 'Content', order: 10 } }

// A module that belongs in the Settings tab:
studio: { nav: { area: 'settings' } }
```

```ts
// Pull a single entity into a named group / order it within one:
Collection({
  slug: 'posts',
  studio: { group: 'Blog', order: 1 },
  fields: { /* … */ },
})
```

Resolution per entity: `studio.group` → the module's `studio.nav.label` →
**ungrouped**. Tabs sort by `studio.nav.order`; items within a rail by
`studio.order`. Custom pages are ungrouped (their own tab) unless they declare
a `group`; settings pages always collect under the Settings tab. Where a
module's section renders as a labelled group inside a rail (e.g. a
settings-area module), `studio.nav.collapsible: true` turns the heading into
a fold toggle (`defaultCollapsed` starts it folded — it still opens for the
active page). Below `lg` both bars collapse into a hamburger menu where the
active tab's rail items nest beneath it.

## Architecture notes

- The engine lives in `@kon10/studio-sdk` (`src/extensions/`): the `StudioZone`
  catalogue, the `ExtensionRegistry`, the `<Slot>` primitive, and React context.
  It is component-aware and therefore **client-only** — extensions never travel
  over RPC.
- `@kon10/start` wires the registry through `Kon10Provider`, merges custom pages
  / nav links into the tab strip and section rails, routes custom + settings
  pages on the Studio splat, and applies field-renderer overrides.
- Adding a new zone is a two-line change: add the literal to `STUDIO_ZONES`, then
  drop a `<Slot zone="…" />` where it should render.

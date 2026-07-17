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
| `login.aside` | A branded side panel, for login layouts that have one | — |
| `login.header` | Above the login form's heading | — |
| `login.form.before` / `login.form.after` | Inside the login form, around the fields (extra actions, a "forgot password?" link) | — |
| `login.footer` | Below the login card | — |

The `login.*` zones render on the **pre-auth** sign-in screen (outside the
Studio shell), so a widget there needs no session — e.g. a "forgot password?"
link in `login.form.after`:

```tsx
// src/studio/widgets/login-forgot.tsx
export const config = defineWidgetConfig({ zone: 'login.form.after' })
export default function LoginForgot() {
  return <a href="/reset-password">Forgot password?</a>
}
```

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

## Branding — logo, name, and the login screen

Branding is **config-driven**: declare it once in `kon10.config.ts` under
`studio.branding`, and it brands both the Studio shell and the `/login` screen.
Every field is optional and falls back to the Kon10 defaults (the `KO` mark and
the "Kon10" wordmark), so an app rebrands the whole Studio without forking any
component.

```ts
// kon10.config.ts
export default defineConfig({
  db: /* … */,
  studio: {
    branding: {
      appName: 'Acme CMS',
      logo: '/logo.svg',            // an image URL/path in your `public/`
      loginTitle: 'Sign in to Acme',
      loginSubtitle: 'Manage your content and media.',
      tagline: 'Ship content faster.',
      taglineSubtitle: 'One Studio for your whole team.',
    },
  },
  modules: [/* … */],
})
```

Because `kon10.config.ts` is server-loaded, the `kon10Start()` Vite plugin lifts
`studio.branding` into a **client-safe** virtual module, `virtual:kon10/studio-config`
(the same config→client bridge that `virtual:kon10/studio-extensions` uses for
Studio UI). Wire it into the provider once — the scaffold already does this:

```tsx
// src/routes/__root.tsx
import { Kon10Provider } from '@kon10/start'
import { studioExtensions } from 'virtual:kon10/studio-extensions'
import { studioConfig } from 'virtual:kon10/studio-config'

<Kon10Provider branding={studioConfig.branding} extensions={studioExtensions}>
  <Outlet />
</Kon10Provider>
```

| Field | Where it shows | Default |
|---|---|---|
| `appName` | Shell wordmark, login subtitle, login footer | `Kon10` |
| `logo` | Shell mark (top nav + mobile menu) and the login mark | The `Kon10Logo` `KO` mark |
| `loginTitle` | Login heading | `Welcome back` |
| `loginSubtitle` | Login subheading | `Sign in to continue to <appName>` |
| `signUpUrl` | Set to show a "Sign up" button linking here; omit to hide it | — (no sign-up) |
| `tagline` | Brand headline — surfaced by side-panel login layouts and the `login.aside` zone | Kon10 default |
| `taglineSubtitle` | Supporting line under the tagline | Kon10 default |

The default login screen is a centered card over a branded backdrop (the logo
above a single form card, scaling to one column at any width). `tagline` /
`taglineSubtitle` are brand metadata that a side-panel layout — a custom login
route, or a widget in the `login.aside` zone — can render.

Because config must serialize into the client bundle, `studio.branding.logo` is
an **image URL/path** (e.g. `/logo.svg`). If you'd rather pass a React element
for the logo — an inline SVG component, a custom `<img>` — the `branding` prop
on `<Kon10Provider>` also accepts a `ReactNode` `logo`, which overrides the
config value:

```tsx
<Kon10Provider
  branding={{ ...studioConfig.branding, logo: <AcmeLogo /> }}
  extensions={studioExtensions}
>
```

Branding is presentation only and client-side; it never travels over RPC. The
default mark is exported as `Kon10Logo` from `@kon10/start` if you want to
compose against it.

### Customizing the login screen

There are three levels, smallest change first:

1. **Branding** (above) — logo, name, copy, tagline. Covers most cases.
2. **Login zones** — inject into the stock login without replacing it: an extra
   action (`login.form.after`), a legal footer (`login.footer`), an announcement
   in the side panel (`login.aside`). See the zone catalogue above.
3. **Full override** — own the route. Disable the built-in login route and
   provide your own, for a completely custom layout or auth flow:

   ```ts
   // vite.config.ts — don't mount the framework login route
   export default defineConfig({ plugins: [kon10Start({ loginPath: false }), viteReact()] })
   ```

   ```tsx
   // src/routes/login.tsx — the app now owns /login
   import { createFileRoute } from '@tanstack/react-router'
   import { Kon10Login } from '@kon10/start' // reuse the default…

   export const Route = createFileRoute('/login')({ component: Kon10Login })
   ```

   Or build a bespoke page and call `useKon10().client.login(email, password)`
   yourself. Keep `Kon10Provider`'s `loginPath` pointed at wherever you mount it,
   so the Studio redirects unauthenticated users to the right place.

## Telemetry: disclosure, opt-out & opt-in

`studio.telemetryNotice` shows a one-time dialog in the Studio on first sign-in.
When `@kon10/telemetry` is configured, the dialog's choices gate the Studio
product events it emits; it can also be used with an operator-provided sink:

```ts
studio: {
  telemetryNotice: {
    enabled: true,
    mode: 'opt-out',  // 'notice' | 'opt-out' | 'opt-in'
    message: '…describe what you collect…',   // sensible defaults if omitted
    policyUrl: 'https://acme.com/privacy',     // optional "Learn more" link
    manageUrl: '/studio/settings/telemetry',  // optional settings destination
  },
}
```

- **`'notice'` (default)** — a disclosure with a single "Got it". Informational
  only: acknowledging it does *not* toggle anything.
- **`'opt-out'`** — collection is on by default and the dialog includes controls
  to turn it off or remove the link to the user's account.
- **`'opt-in'`** — asks consent (Allow / No thanks). Studio product events are
  not captured until the user explicitly chooses Allow.

Either way it shows once per user (stored in `localStorage`), and is wired
through the provider like branding:
`<Kon10Provider telemetryNotice={studioConfig.telemetryNotice} …>`.

### Reading consent in custom analytics

The same consent primitive is available to custom Studio analytics:

```tsx
import { useTelemetryConsent } from '@kon10/start'

function Analytics() {
  const { status, grant, deny } = useTelemetryConsent() // 'granted' | 'denied' | 'unset'
  useEffect(() => {
    if (status === 'granted') startAnalytics()  // your SDK; nothing runs until granted
  }, [status])
  return null
}
```

`grant()` / `deny()` let users change their mind, while `setAnonymous()` controls
whether account-linked properties are included. The ready-made
`TelemetrySettings` page exposes both choices. Outside the Studio,
`getTelemetryConsent(userId)` reads the same browser-local value. Use a
server-side record if you need a cross-device or auditable consent trail.

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

# Admin UI Rebrand — Repayload kit → kon10-cms

**Date:** 2026-06-22
**Status:** Approved (brainstorming → ready for implementation plan)

## Goal

Rebrand and re-lay-out the kon10-cms admin UI to match the "Repayload CMS
Design System" UI kit (`ui_kit/index.html` + `app.jsx`/`screens.jsx`/`kit.css`
in the claude.ai design project `3177963e-…`). The kit is the **visual spec**;
kon10-cms is the codebase. Top navbar, sidebar, and content layout must align
with the kit while staying driven by the real kon10-cms config/RPC.

## Decisions (from brainstorming)

1. **Brand-only topbar.** The kit's Organization switcher (top nav) and Website
   switcher (sidebar) are **omitted** — kon10-cms has no org/website model. The
   topbar shows the brand mark + "Kon10" wordmark (left) and the user menu
   (right). The sidebar starts directly with nav.
2. **Full kit parity, config-driven.** Rebuild all kit screens, but mapped onto
   real kon10-cms data via the existing RPC client. Screens with no backend
   equivalent (Media) become styled empty-state placeholders rather than mock
   data.
3. **Dark mode with persistence.** Add a theme toggle in the user menu that sets
   `.dark` on `<html>` and persists to `localStorage` (re-applied on load).

## Non-goals

- No new backend concepts (no organizations, no websites, no media storage).
- No design-token work — `packages/ui/src/styles/globals.css` already defines
  every token the kit uses (`--header-height`, `--sidebar-width`,
  `--content-max`, `--space-*`, `--text-*`, `--radius-*`, Geist fonts, full
  `.dark` theme).
- No changes to RPC contract, auth, or `kon10.config.ts`.
- No port of the kit's standalone CDN/Babel runtime — we use the existing
  React + TanStack Start + Tailwind setup.

## Architecture

The kit's chrome is a **full-width sticky topbar over a (sidebar + content)
row**, replacing the current "sidebar beside (topbar + content)" layout.

Package boundaries are preserved:

- `@kon10/admin-sdk` — reusable, data-agnostic chrome (renders layout + slots).
- `@kon10/start` — wiring: supplies real session, nav, theme handlers, and
  screen content via the RPC client.
- `@kon10/ui` — shadcn primitives (already match the kit), consumed as-is.

### Files

**`packages/admin-sdk/src/shell/`**

| File | Change | Purpose |
|---|---|---|
| `AdminShell.tsx` | rework | Column: `<Topbar/>` on top, then `<div class="flex flex-1">` with desktop `<Sidebar/>` + `<MobileDrawer/>` + `<main>`. Owns internal `drawerOpen` state. New props: `user`, `onSignOut`, `theme`, `onThemeChange`. |
| `Topbar.tsx` | rework | Burger (mobile only) + brand mark + wordmark (left); `UserMenu` (right). Brand-only, no switchers, no page title. |
| `Sidebar.tsx` | rework | Nav only — logo removed (moved to topbar), footer "Payload admin" link dropped. Same component used by desktop aside and mobile drawer. |
| `MobileDrawer.tsx` | new | Fixed scrim (`oklch(0 0 0 / 0.4)`) + left panel sliding in at `.22s cubic-bezier(.4,0,.2,1)`, containing the Sidebar nav. Closes on nav/scrim click. |
| `UserMenu.tsx` | new | Avatar + email trigger → dropdown: identity header (email/role), Theme section (Sun/Moon + active dot), separator, destructive "Sign out". Closes on outside click. |
| `PageHeader.tsx` | new | In-content title + description + actions slot. Matches kit `.kit-pagehead`. |
| `EmptyState.tsx` | new | Dashed-border card empty state. Matches kit `.kit-empty`. |
| `useTheme.ts` | new | `localStorage['kon10-theme']` (default light), toggles `.dark` on `<html>`, persists on change. SSR-safe (applied in `useEffect`). |

`@kon10/admin-sdk/src/index.ts` re-exports the new components/types.

## Component specs

### AdminShell
- Outer `<div class="flex min-h-screen flex-col bg-background text-foreground">`.
- `<Topbar>` first (sticky `top-0 z-40`, full width, `h-(--header-height)`).
- `<div class="flex flex-1 min-h-0">`: desktop `<Sidebar>` (sticky
  `top-(--header-height)`, `h-[calc(100vh-var(--header-height))]`, hidden below
  `860px` via a `max-[860px]:hidden`-style utility), `<MobileDrawer>`, and
  `<main class="flex-1 min-w-0 p-page">` with inner
  `mx-auto w-full max-w-content-max`.
- Holds `drawerOpen` (`useState`); passes setter to Topbar burger and Drawer.

### Topbar
- `<header class="sticky top-0 z-40 flex h-(--header-height) items-center
  justify-between gap-3 border-b border-border bg-background px-4">`.
- Left: burger button (`inline-flex` only below 860px), brand mark (`grid size-7
  place-items-center rounded-[var(--radius-md)] bg-primary text-primary-foreground`)
  + wordmark.
- Right: `<UserMenu>`.

### Sidebar
- Keep existing registry grouping (Overview / Content / Configuration from
  `GROUP_LABEL`/`GROUP_ORDER`/`KIND_ICON`) and active-link logic.
- Remove the brand `<a>` block and the `__foot` link.
- Container: `flex h-full w-(--sidebar-width) shrink-0 flex-col gap-6 border-r
  border-sidebar-border bg-sidebar p-sidebar overflow-y-auto`.
- Accept an optional `onNavigate` callback so the mobile drawer can close on
  link click.

### MobileDrawer
- Scrim: `fixed inset-0 z-50 bg-[oklch(0_0_0/0.4)]`, opacity-driven by
  `data-open`, `pointer-events` gated.
- Panel: `fixed top-(--header-height) left-0 bottom-0 z-60 w-[268px] max-w-[84vw]
  bg-sidebar border-r border-sidebar-border` with
  `transform translate-x-[-100%]` → `0` on open, transition
  `.22s cubic-bezier(.4,0,.2,1)`. Renders `<Sidebar onNavigate={close}/>`.

### UserMenu
- Trigger: `Avatar` (initials from email) + email (hidden below 540px).
- Dropdown (`absolute right-0 top-[calc(100%+6px)] z-70`, `bg-popover`,
  `border`, `rounded-md`, `shadow-lg`, `min-w-[224px]`): identity header
  (email, role) → separator → "Theme" label + Light/Moon items (active marked) →
  separator → destructive "Sign out".
- Outside-click closes (fixed transparent overlay behind the menu, matching the
  kit pattern).

### PageHeader
- `flex flex-col gap-3 mb-[22px]`; row with title (`text-2xl font-semibold
  tracking-[-0.015em]`) + optional description (`text-body text-muted-foreground`)
  and an actions slot (`flex gap-2`).

### EmptyState
- `flex flex-col items-center justify-center gap-3 p-16 text-center border
  border-dashed border-border rounded-xl`; icon chip + title + description +
  optional action.

### useTheme
- `const [theme, setTheme] = useState<'light'|'dark'>('light')`.
- On mount: read `localStorage['kon10-theme']`, apply.
- On change: `document.documentElement.classList.toggle('dark', t==='dark')` +
  persist. Returns `{ theme, setTheme }`.

## Screens (in `@kon10/start/admin.tsx`, real RPC)

All wrapped by `PageHeader`; reuse `@kon10/ui` (Card, Table, Tabs, StatusBadge,
Badge, Avatar) and `@kon10/admin-sdk` views (CollectionForm/List, DocumentForm).

| Screen | Source | Notes |
|---|---|---|
| Dashboard | `client.nav()` + `client.list(slug)` counts | Kit 4-up stat-card grid (one card per collection, value = row count, links to list) + a "Recent" card listing the first collection's latest rows with `StatusBadge`. |
| Collection list (Posts) | `client.entity`, `client.list` | `PageHeader` + "New"; status `Tabs` filter **only** when the entity has a `status` select field; padding-free Card wrapping styled `CollectionList` (mono slug, icon-action edit/delete). Zero rows → `EmptyState`. |
| Editor (create/edit) | `EntityDescriptor.fields`, `CollectionForm` | Kit 2-column layout: main fields left, `admin.sidebar` fields (status/slug) right; sticky translucent save-bar (Cancel / Save). |
| Users | `client.list('users')` | Table: avatar + name, email, role `Badge`. "New user" action. |
| Settings (document) | session + `site-settings` via `DocumentForm` | Two-up cards: Account (session identity) + the document fields, kit row styling. |
| Media | — (no backend) | Styled `EmptyState` ("No media yet — upload to get started"). No mock data. |
| Login | existing `client.login` | Restyle to kit: centered card on `--muted`, brand mark, "Welcome back". Auth flow unchanged. |

## Responsive behavior

- `< 860px`: desktop sidebar hidden, burger shown, drawer enabled.
- Stat grid: 4-up → 2-up below 720px.
- Editor: 2-col → 1-col below 900px.
- Settings: 2-up → 1-up below 720px.
- User-menu email hidden below 540px.

## Testing / verification

- Build the playground app and drive the admin in a browser (login → dashboard →
  posts list → editor → users → settings → media), at desktop and mobile widths,
  in light and dark themes. Capture screenshots as evidence.
- Confirm theme persists across reload.
- Confirm real data renders (collection counts, posts rows, users) and zero-row
  lists show the empty state.

## Out of scope / follow-ups

- Real media storage + Media screen wiring.
- Organization / website multi-tenancy (the kit's switchers).
- Pushing any of this back to the claude.ai design project.

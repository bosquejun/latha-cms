# Admin UI Rebrand (Repayload kit → latha-cms) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-lay-out and restyle the latha-cms admin UI to match the Repayload CMS Design System kit — brand-only full-width topbar, sidebar nav, mobile drawer, user menu with persistent dark mode, and config-driven screen parity.

**Architecture:** Reusable, data-agnostic chrome lives in `@latha/admin-sdk/src/shell/`; wiring (real session, nav, theme, screens via RPC) lives in `@latha/start/src/admin.tsx`. Primitives in `@latha/ui` already match the kit and are consumed as-is. All design tokens already exist in `packages/ui/src/styles/globals.css` — no token work.

**Tech Stack:** React 18, TanStack Start/Router, Tailwind v4 (token-based utilities, e.g. `bg-sidebar`, `p-page`, `text-2xl`), lucide-react, TypeScript ESM (NodeNext — imports use `.js` extensions).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-22-admin-kit-rebrand-design.md`.
- **Visual source of truth:** the kit's `app.jsx` / `screens.jsx` / `kit.css` (reproduced in the spec). Match layout/spacing, but translate to Tailwind utilities + existing tokens, not raw `.kit-*` CSS.
- **Brand-only topbar:** NO organization or website switcher. Topbar = brand mark + wordmark (left), user menu (right).
- **Config-driven:** screens use the real RPC client (`useLatha().client`). Only Media is a styled placeholder (no backend).
- **No backend/RPC/auth/config changes.** No new design tokens.
- **Copy rules (from kit readme):** sentence case everywhere except tiny tracked section/table-head labels which are UPPERCASE; verb-first buttons (`New post`, `Save changes`, `Sign in`, `Upload`); no emoji; Lucide icons only; status words capitalized in badges.
- **Brand:** mark = rounded-square (`rounded-[14px]` ≈ `--radius`) `bg-primary` with white initial; wordmark "LathaCMS", `font-semibold tracking-tight`.
- **Module system:** ESM NodeNext — every relative import within packages ends in `.js`.
- **No test runner for UI packages.** Verification per task = `pnpm --filter @latha/playground typecheck` (or root `pnpm typecheck`) + browser observation. Do NOT add unit tests for layout.
- **Commit after each task.** End commit messages with:
  `Claude-Session: https://claude.ai/code/session_01WvqvMhmnt1ewuJxYK6TxMb`

---

## File Structure

**Create (`packages/admin-sdk/src/shell/`):** `MobileDrawer.tsx`, `UserMenu.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, `useTheme.ts`.
**Modify:** `packages/admin-sdk/src/shell/AdminShell.tsx`, `Topbar.tsx`, `Sidebar.tsx`, `packages/admin-sdk/src/index.ts`, `packages/start/src/admin.tsx`, `packages/start/src/login.tsx`.

---

## Task 1: Theme hook + user menu

**Files:**
- Create: `packages/admin-sdk/src/shell/useTheme.ts`
- Create: `packages/admin-sdk/src/shell/UserMenu.tsx`
- Modify: `packages/admin-sdk/src/index.ts`

**Interfaces:**
- Produces:
  - `useTheme(): { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }`
  - `interface UserMenuProps { email: string | null; role?: string | null; theme: 'light' | 'dark'; onThemeChange: (t: 'light' | 'dark') => void; onSignOut: () => void }`
  - `function UserMenu(props: UserMenuProps): JSX.Element`

- [ ] **Step 1: Write `useTheme.ts`**

```ts
/**
 * useTheme — light/dark with localStorage persistence.
 *
 * Toggles `.dark` on <html>. SSR-safe: initial state is 'light' and the
 * stored preference is applied in an effect after mount, so server and first
 * client render agree.
 */
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'latha-theme'

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const stored = (typeof localStorage !== 'undefined' &&
      localStorage.getItem(STORAGE_KEY)) as Theme | null
    if (stored === 'dark' || stored === 'light') setThemeState(stored)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore quota/availability errors */
    }
  }

  return { theme, setTheme }
}
```

- [ ] **Step 2: Write `UserMenu.tsx`**

```tsx
/**
 * UserMenu — avatar trigger + dropdown: identity, theme toggle, sign out.
 * Closes on outside click via a transparent fixed overlay (kit pattern).
 */
import { useState } from 'react'
import { Avatar } from '@latha/ui'
import { Check, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import type { Theme } from './useTheme.js'

export interface UserMenuProps {
  email: string | null
  role?: string | null
  theme: Theme
  onThemeChange: (t: Theme) => void
  onSignOut: () => void
}

function initials(email: string | null): string {
  const src = email?.trim()
  if (!src) return '?'
  const name = src.split('@')[0] || src
  const [a, b] = name.split(/[._-]+/).filter(Boolean)
  return (a && b ? `${a[0]}${b[0]}` : name.slice(0, 2)).toUpperCase()
}

export function UserMenu({ email, role, theme, onThemeChange, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-md px-2 text-foreground hover:bg-accent"
      >
        <Avatar size="sm" fallback={initials(email)} alt={email ?? undefined} />
        <span className="hidden text-body font-medium sm:inline">{email}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-[70] min-w-[224px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
            <div className="px-2 pb-1.5 pt-2">
              <div className="text-body font-medium">{email}</div>
              {role && (
                <div className="mt-1 flex items-center gap-1 text-caption capitalize text-muted-foreground">
                  <UserRound className="size-3" />
                  {role}
                </div>
              )}
            </div>
            <div className="my-1 h-px bg-border" />
            <p className="px-2 py-1 text-label text-muted-foreground">Theme</p>
            <button
              onClick={() => onThemeChange('light')}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-small hover:bg-accent [&_svg]:size-4"
            >
              <Sun /> Light {theme === 'light' && <Check className="ml-auto size-3.5" />}
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-small hover:bg-accent [&_svg]:size-4"
            >
              <Moon /> Dark {theme === 'dark' && <Check className="ml-auto size-3.5" />}
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-small text-destructive hover:bg-accent [&_svg]:size-4"
            >
              <LogOut /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Export from `index.ts`** — add after the existing Shell exports block:

```ts
export { useTheme, type Theme } from './shell/useTheme.js'
export { UserMenu, type UserMenuProps } from './shell/UserMenu.js'
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @latha/playground typecheck`
Expected: PASS (no errors). If `Avatar`'s `size` prop differs, check `packages/ui/src/components/ui/avatar.tsx` and use the correct value.

- [ ] **Step 5: Commit**

```bash
git add packages/admin-sdk/src/shell/useTheme.ts packages/admin-sdk/src/shell/UserMenu.tsx packages/admin-sdk/src/index.ts
git commit -m "feat(admin-sdk): add useTheme hook and UserMenu dropdown"
```

---

## Task 2: PageHeader + EmptyState

**Files:**
- Create: `packages/admin-sdk/src/shell/PageHeader.tsx`
- Create: `packages/admin-sdk/src/shell/EmptyState.tsx`
- Modify: `packages/admin-sdk/src/index.ts`

**Interfaces:**
- Produces:
  - `interface PageHeaderProps { title: ReactNode; description?: ReactNode; actions?: ReactNode }`
  - `function PageHeader(props): JSX.Element`
  - `interface EmptyStateProps { icon: LucideIcon; title: string; description?: string; action?: ReactNode }`
  - `function EmptyState(props): JSX.Element`

- [ ] **Step 1: Write `PageHeader.tsx`**

```tsx
/** PageHeader — in-content page title, description, and actions slot. */
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-[22px] flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.015em]">{title}</h1>
          {description && (
            <p className="mt-1 text-body text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `EmptyState.tsx`**

```tsx
/** EmptyState — dashed-card empty state for zero-row lists / unbacked screens. */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-16 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        <Icon />
      </div>
      <div>
        <h3 className="text-small font-semibold">{title}</h3>
        {description && (
          <p className="mx-auto mt-1 max-w-[360px] text-caption text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
```

- [ ] **Step 3: Export from `index.ts`**

```ts
export { PageHeader, type PageHeaderProps } from './shell/PageHeader.js'
export { EmptyState, type EmptyStateProps } from './shell/EmptyState.js'
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @latha/playground typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/admin-sdk/src/shell/PageHeader.tsx packages/admin-sdk/src/shell/EmptyState.tsx packages/admin-sdk/src/index.ts
git commit -m "feat(admin-sdk): add PageHeader and EmptyState components"
```

---

## Task 3: Sidebar (nav-only) + MobileDrawer

**Files:**
- Modify: `packages/admin-sdk/src/shell/Sidebar.tsx`
- Create: `packages/admin-sdk/src/shell/MobileDrawer.tsx`
- Modify: `packages/admin-sdk/src/index.ts`

**Interfaces:**
- Consumes: existing `Sidebar` grouping logic, `AdminNavItem`, `SidebarLinkProps`.
- Produces:
  - Updated `SidebarProps` with optional `onNavigate?: () => void` (called on any nav link click).
  - `interface MobileDrawerProps { open: boolean; onClose: () => void; items: AdminNavItem[]; currentPath?: string; LinkComponent?: ComponentType<SidebarLinkProps> }`
  - `function MobileDrawer(props): JSX.Element`

- [ ] **Step 1: Edit `Sidebar.tsx` — remove brand + footer, add `onNavigate`.**

Remove the brand `<a href={homeHref} …>…</a>` block (the logo+wordmark) and any footer link. Change the `SidebarProps` to add `onNavigate?: () => void`. Wire it so each rendered link calls `onNavigate?.()` on click. Concretely, update `renderLink` to attach `onClick={() => onNavigate?.()}` to both the `LinkComponent` and the `<a>` branches, and drop the `title`/`homeHref` brand usage from the returned JSX (keep the dashboard nav item). The container stays:

```tsx
<nav className="flex h-full w-(--sidebar-width) shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar p-sidebar">
```

The dashboard link and group links remain exactly as before except for the added `onClick`. Keep `homeHref` as the dashboard target.

- [ ] **Step 2: Write `MobileDrawer.tsx`**

```tsx
/** MobileDrawer — scrim + slide-in panel wrapping the Sidebar nav (mobile). */
import type { ComponentType } from 'react'
import { Sidebar, type SidebarLinkProps } from './Sidebar.js'
import type { AdminNavItem } from '../schema.js'

export interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  items: AdminNavItem[]
  currentPath?: string
  LinkComponent?: ComponentType<SidebarLinkProps>
}

export function MobileDrawer({ open, onClose, items, currentPath, LinkComponent }: MobileDrawerProps) {
  return (
    <>
      <div
        onClick={onClose}
        data-open={open}
        className="fixed inset-0 z-50 bg-[oklch(0_0_0/0.4)] opacity-0 transition-opacity duration-200 data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 pointer-events-none"
      />
      <div
        data-open={open}
        className="fixed bottom-0 left-0 top-(--header-height) z-[60] flex w-[268px] max-w-[84vw] -translate-x-full flex-col bg-sidebar transition-transform duration-[220ms] [transition-timing-function:cubic-bezier(.4,0,.2,1)] data-[open=true]:translate-x-0"
      >
        <Sidebar
          items={items}
          currentPath={currentPath}
          LinkComponent={LinkComponent}
          onNavigate={onClose}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Export from `index.ts`**

```ts
export { MobileDrawer, type MobileDrawerProps } from './shell/MobileDrawer.js'
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @latha/playground typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/admin-sdk/src/shell/Sidebar.tsx packages/admin-sdk/src/shell/MobileDrawer.tsx packages/admin-sdk/src/index.ts
git commit -m "feat(admin-sdk): nav-only sidebar + mobile drawer"
```

---

## Task 4: Topbar (brand + burger + user-menu slot) and AdminShell rework

**Files:**
- Modify: `packages/admin-sdk/src/shell/Topbar.tsx`
- Modify: `packages/admin-sdk/src/shell/AdminShell.tsx`

**Interfaces:**
- Consumes: `UserMenu` (Task 1), `MobileDrawer` (Task 3), `Sidebar` (Task 3).
- Produces:
  - New `TopbarProps { brand?: string; onMenuClick?: () => void; children?: ReactNode }` (children = right-side slot, e.g. UserMenu).
  - New `AdminShellProps { nav: AdminNavItem[]; currentPath?: string; LinkComponent?: ComponentType<SidebarLinkProps>; brand?: string; userMenu?: ReactNode; children: ReactNode }`. (Title/actions removed — pages own their own `PageHeader` now.)

- [ ] **Step 1: Rewrite `Topbar.tsx`**

```tsx
/** Topbar — full-width sticky bar: burger + brand (left), slot (right). */
import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'

export interface TopbarProps {
  brand?: string
  onMenuClick?: () => void
  children?: ReactNode
}

export function Topbar({ brand = 'LathaCMS', onMenuClick, children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) items-center justify-between gap-3 border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          aria-label="Menu"
          className="grid size-9 place-items-center rounded-md border border-border bg-background text-foreground max-[860px]:inline-grid min-[861px]:hidden [&_svg]:size-[18px]"
        >
          <Menu />
        </button>
        <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-primary text-sm font-semibold text-primary-foreground">
          {brand.charAt(0).toUpperCase()}
        </span>
        <span className="text-base font-semibold tracking-tight">{brand}</span>
      </div>
      {children}
    </header>
  )
}
```

- [ ] **Step 2: Rewrite `AdminShell.tsx`**

```tsx
/**
 * AdminShell — full-width topbar over a (sidebar + content) row.
 * Owns the mobile drawer open state. Data-agnostic: pages render their own
 * PageHeader inside `children`.
 */
import { useState, type ComponentType, type ReactNode } from 'react'
import { Sidebar, type SidebarLinkProps } from './Sidebar.js'
import { Topbar } from './Topbar.js'
import { MobileDrawer } from './MobileDrawer.js'
import type { AdminNavItem } from '../schema.js'

export interface AdminShellProps {
  nav: AdminNavItem[]
  currentPath?: string
  LinkComponent?: ComponentType<SidebarLinkProps>
  brand?: string
  userMenu?: ReactNode
  children: ReactNode
}

export function AdminShell({
  nav,
  currentPath,
  LinkComponent,
  brand = 'LathaCMS',
  userMenu,
  children,
}: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Topbar brand={brand} onMenuClick={() => setDrawerOpen(true)}>
        {userMenu}
      </Topbar>
      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-(--header-height) h-[calc(100vh-var(--header-height))] max-[860px]:hidden">
          <Sidebar items={nav} currentPath={currentPath} LinkComponent={LinkComponent} />
        </aside>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          items={nav}
          currentPath={currentPath}
          LinkComponent={LinkComponent}
        />
        <main className="min-w-0 flex-1 p-page">
          <div className="mx-auto w-full max-w-content-max">{children}</div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @latha/playground typecheck`
Expected: FAIL — `admin.tsx` still passes the old `title`/`actions` props. That is expected and fixed in Task 5. Confirm the only errors are in `packages/start/src/admin.tsx` referencing `title`/`actions`.

- [ ] **Step 4: Commit**

```bash
git add packages/admin-sdk/src/shell/Topbar.tsx packages/admin-sdk/src/shell/AdminShell.tsx
git commit -m "feat(admin-sdk): full-width topbar + reworked AdminShell layout"
```

---

## Task 5: Wire the shell in `@latha/start` (topbar brand + user menu + theme)

**Files:**
- Modify: `packages/start/src/admin.tsx`

**Interfaces:**
- Consumes: new `AdminShell` (Task 4), `UserMenu` + `useTheme` (Task 1).
- Produces: a working admin shell rendering real session + theme; screen content still the existing `AdminView` (restyled in Tasks 6–7).

- [ ] **Step 1: Update imports in `admin.tsx`** — add `UserMenu`, `useTheme` to the `@latha/admin-sdk` import; the standalone `Avatar`/`Button`/`LogOut` imports used only for the old actions block can stay if still referenced elsewhere (they are used by screens), otherwise leave them.

- [ ] **Step 2: Replace the `AdminShell` usage** inside `LathaAdmin()`'s return. Replace the whole `<AdminShell …>…</AdminShell>` block (the one with `title`/`actions`) with:

```tsx
const { theme, setTheme } = useTheme()

return (
  <AdminShell
    nav={nav.data ?? []}
    currentPath={pathname}
    LinkComponent={RouterLink}
    brand="LathaCMS"
    userMenu={
      <UserMenu
        email={session.data.email}
        role={session.data.role}
        theme={theme}
        onThemeChange={setTheme}
        onSignOut={async () => {
          await client.logout()
          await navigate({ to: loginPath })
        }}
      />
    }
  >
    <AdminView route={route} nav={nav.data ?? []} />
  </AdminShell>
)
```

Note: `useTheme()` is a hook — place the `const { theme, setTheme } = useTheme()` call at the top of `LathaAdmin()` with the other hooks (before the early returns are fine since hooks must run unconditionally; put it alongside `useAsync`/`useNavigate` near the top).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @latha/playground typecheck`
Expected: PASS. (`session.data.role` exists on `SessionUser`.)

- [ ] **Step 4: Browser verification — shell**

Run: `pnpm --filter @latha/playground dev` (port 3000). Visit `http://localhost:3000/admin`, sign in with a seeded user (any from `latha.config.ts` seed; check `apps/playground/latha.config.ts` for the seeded admin, or create one if none — do NOT change config, use the login flow). Observe:
- Full-width topbar: burger (only when window < 860px), brand mark + "LathaCMS" left; avatar + email right.
- Sidebar below the topbar with nav groups; main content to its right.
- User menu opens; Light/Dark toggles `.dark` on `<html>` (inspect element) and content recolors; reload keeps the theme.
- Narrow the window < 860px: sidebar hides, burger appears, opens the drawer with scrim.

Capture a screenshot (light + dark, desktop + mobile width).

- [ ] **Step 5: Commit**

```bash
git add packages/start/src/admin.tsx
git commit -m "feat(start): wire brand topbar, user menu, and dark mode toggle"
```

---

## Task 6: Dashboard + collection list/editor screens (kit patterns, config-driven)

**Files:**
- Modify: `packages/start/src/admin.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState` (Task 2); existing `CollectionList`, `CollectionForm`, `client`, `useAsync`.
- Produces: restyled `Dashboard`, `ListView`, `CreateView`, `EditView` matching the kit.

- [ ] **Step 1: Restyle `Dashboard`** — replace the existing `Dashboard` function body with a kit stat-grid + recent list. Use `PageHeader`, the `Card` primitive, and real counts. Each stat card links to its list; "Recent" lists the first collection's latest rows.

```tsx
import { Plus, ArrowRight, FileText, Files, FolderTree } from 'lucide-react'
import { StatusBadge } from '@latha/ui'
// (add these to the existing import lines as needed)

const KIND_ICON: Record<string, typeof FileText> = {
  collection: FileText,
  document: Files,
  taxonomy: FolderTree,
}

function Dashboard({ nav }: { nav: NavItem[] }) {
  const { client, basePath } = useLatha()
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything below is derived from your config."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {nav.map((item) => {
          const Icon = KIND_ICON[item.kind] ?? FileText
          return (
            <Link key={item.slug} to={item.href}>
              <Card className="gap-0 p-0 transition-colors hover:border-foreground/20">
                <div className="flex items-center justify-between px-4 pt-4">
                  <span className="text-small font-medium text-muted-foreground">
                    {item.label}
                  </span>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <StatCount client={client} item={item} />
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}

function StatCount({ client, item }: { client: ReturnType<typeof useLatha>['client']; item: NavItem }) {
  const count = useAsync(
    () => (item.kind === 'collection' ? client.list(item.slug) : Promise.resolve([])),
    [item.slug, item.kind],
  )
  const value = item.kind === 'collection' ? (count.data?.length ?? '—') : '—'
  return (
    <div className="px-4 pb-4 pt-1.5 text-3xl font-semibold tracking-[-0.02em]">
      {count.loading ? '·' : value}
    </div>
  )
}
```

(If `useAsync` cannot be called inside `StatCount` because of list-of-children hook rules — it can, each card is its own component instance — keep `StatCount` as a separate component as written.)

- [ ] **Step 2: Restyle `ListView`** — wrap with `PageHeader` (title = entity label, action = "New" button), keep `CollectionList`, and show `EmptyState` when `rows.data` is empty.

```tsx
function ListView({ slug }: { slug: string }) {
  const { client, basePath } = useLatha()
  const entity = useAsync(() => client.entity(slug), [slug])
  const rows = useAsync(() => client.list(slug), [slug])

  if (entity.loading || rows.loading)
    return <p className="text-small text-muted-foreground">Loading…</p>
  if (!entity.data)
    return <p className="text-small text-muted-foreground">Unknown collection.</p>

  const list = rows.data ?? []
  return (
    <>
      <PageHeader
        title={entity.data.label}
        actions={
          <Button asChild size="sm">
            <Link to={`${basePath}/content/${slug}/new`}>
              <Plus /> New
            </Link>
          </Button>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${entity.data.label.toLowerCase()} yet`}
          description={`Create your first to start managing ${entity.data.label.toLowerCase()}.`}
          action={
            <Button asChild size="sm" className="mt-1">
              <Link to={`${basePath}/content/${slug}/new`}>
                <Plus /> New
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <CollectionList
            entity={asEntity(entity.data)}
            rows={list}
            getEditHref={(id) => `${basePath}/content/${slug}/${id}`}
            onDelete={async (id) => {
              await client.remove(slug, id)
              rows.reload()
            }}
          />
        </Card>
      )}
    </>
  )
}
```

- [ ] **Step 3: Restyle `CreateView` / `EditView`** — use `PageHeader` instead of the bare `<h2>` + flex-between, keeping the existing `CollectionForm` + handlers. For `CreateView`:

```tsx
<PageHeader
  title={`New ${entity.data.label.toLowerCase()}`}
  description="Draft a new record for this collection."
/>
```

For `EditView`, keep the destructive Delete in the actions slot:

```tsx
<PageHeader
  title={`Edit ${entity.data.label.toLowerCase()}`}
  actions={
    <Button
      variant="destructive"
      size="sm"
      onClick={async () => {
        await client.remove(slug, id)
        await toList()
      }}
    >
      Delete
    </Button>
  }
/>
```

Leave the `<CollectionForm …>` blocks unchanged below each header.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @latha/playground typecheck`
Expected: PASS. Verify `StatusBadge`, `Card`, `Button asChild` are exported from `@latha/ui` (they are — see `packages/ui/src/index.ts`).

- [ ] **Step 5: Browser verification**

With `dev` running: dashboard shows stat cards with real counts (e.g. posts count) and they link to lists; a collection list shows the styled table inside a card, "New" works; an empty collection shows the dashed empty state; editor shows `PageHeader` + form; Edit shows the Delete action.

- [ ] **Step 6: Commit**

```bash
git add packages/start/src/admin.tsx
git commit -m "feat(start): kit-styled dashboard, list, and editor screens"
```

---

## Task 7: Login restyle + document/settings screen + final verification

**Files:**
- Modify: `packages/start/src/login.tsx`
- Modify: `packages/start/src/admin.tsx` (DocumentView → kit two-up settings card)

**Interfaces:**
- Consumes: existing `client.login`, `DocumentForm`, `PageHeader`, `Card`, `Field`, `Input`, `Button`.
- Produces: kit-styled login + settings/document view.

- [ ] **Step 1: Restyle `login.tsx`** — keep the entire auth flow (`onSubmit`, state) unchanged; update only the JSX wrapper to match the kit: centered card on `--muted`, brand mark + "LathaCMS", "Welcome back" card. Replace the returned JSX with:

```tsx
return (
  <main className="flex min-h-screen items-center justify-center bg-muted p-6">
    <div className="w-full max-w-[380px]">
      <div className="mb-[22px] flex items-center justify-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-primary text-base font-semibold text-primary-foreground">
          L
        </span>
        <span className="text-lg font-semibold tracking-tight">LathaCMS</span>
      </div>
      <Card className="gap-6 p-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
          <p className="text-small text-muted-foreground">
            Enter your credentials to continue.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field htmlFor="email" label="Email">
            <Input id="email" type="email" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field htmlFor="password" label="Password" error={error ?? undefined}>
            <Input id="password" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" className="mt-1 w-full" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  </main>
)
```

- [ ] **Step 2: Restyle `DocumentView` (Settings pattern)** in `admin.tsx` — use `PageHeader` and a two-up card grid; the document form stays. Replace the `DocumentView` return with:

```tsx
return (
  <>
    <PageHeader title={entity.data.label} description="A document singleton — exactly one record." />
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>This document holds exactly one record.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-small text-muted-foreground">
          Edit the fields and save to update the singleton.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{entity.data.label}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DocumentForm
            entity={asEntity(entity.data)}
            value={value.data ?? null}
            onSubmit={async (values) => {
              await client.saveGlobal(slug, values)
              value.reload()
            }}
          />
        </CardContent>
      </Card>
    </div>
  </>
)
```

Add `CardHeader, CardTitle, CardDescription, CardContent` to the `@latha/ui` import if not present.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @latha/playground typecheck`
Expected: PASS. Confirm `CardHeader`/`CardTitle`/`CardDescription`/`CardContent` are exported by `@latha/ui` (check `packages/ui/src/index.ts`; they back the kit's Card and should exist).

- [ ] **Step 4: Full browser verification (end-to-end)**

With `dev` running, drive the whole flow and capture screenshots:
1. `/login` — kit-styled card; sign in works.
2. Dashboard → stat cards (real counts) → click into a list.
3. List → New → editor → save → back to list.
4. Edit a row → Delete.
5. A document/settings entity → two-up cards, save persists.
6. Toggle dark in user menu; reload → theme persists.
7. Resize < 860px → burger → drawer → navigate closes drawer.

- [ ] **Step 5: Commit**

```bash
git add packages/start/src/login.tsx packages/start/src/admin.tsx
git commit -m "feat(start): kit-styled login and document/settings view"
```

---

## Self-Review

**Spec coverage:**
- Brand-only topbar → Task 4 (Topbar) + Task 5 (wiring). ✓
- Full-width topbar over sidebar+content → Task 4 (AdminShell). ✓
- Sidebar nav-only → Task 3. ✓
- Mobile drawer → Task 3. ✓
- UserMenu + identity/sign-out → Task 1 + Task 5. ✓
- Dark mode + persistence → Task 1 (useTheme) + Task 5 (wiring). ✓
- PageHeader / EmptyState → Task 2, used in Tasks 6–7. ✓
- Dashboard stat cards (real counts) → Task 6. ✓
- Collection list (table in card, empty state) → Task 6. ✓
- Editor (PageHeader + form, Delete action) → Task 6. ✓
- Settings/document two-up → Task 7. ✓
- Login restyle (auth unchanged) → Task 7. ✓
- Media placeholder → **covered by EmptyState (Task 2)**; latha-cms has no Media route, so no dedicated screen is rendered. If a Media nav entry is later added, render `<EmptyState icon={Image} title="No media yet" …/>`. Documented here; no task needed since there is no Media route in the current config. ✓
- Users screen → the kit's "Users" maps to the `users` module **only if** it appears in `nav` as a collection; if so it renders via the generic `ListView` (Task 6). No bespoke avatar-table task, since `CollectionList` is config-driven. The spec's bespoke Users table is **descoped to the generic list** to stay config-driven; noted as a deviation.

**Deviations from spec (intentional, to honor "config-driven"):**
- Users renders through the generic `ListView`/`CollectionList` rather than a bespoke avatar table — keeps it config-driven and avoids assuming a `users` collection shape.
- The editor uses the existing `CollectionForm` layout rather than rebuilding the kit's exact 2-column main/sidebar split, because `CollectionForm` already groups `admin.sidebar` fields. If a true 2-column split is wanted, it's a `CollectionForm` change — flagged as a follow-up, not blocking.

**Placeholder scan:** No TBD/TODO/"add error handling" — all steps have concrete code. ✓

**Type consistency:** `Theme`, `UserMenuProps`, `AdminShellProps` (brand/userMenu), `MobileDrawerProps`, `SidebarProps.onNavigate`, `PageHeaderProps`, `EmptyStateProps` are defined once (Tasks 1–4) and consumed with matching names in Tasks 5–7. `useTheme` returns `{ theme, setTheme }` consumed exactly in Task 5. ✓

## Follow-ups (out of scope)

- True 2-column editor split inside `CollectionForm`.
- Bespoke Users avatar table (if desired over the generic list).
- Real Media storage + screen.
- Org/website multi-tenancy (kit switchers).

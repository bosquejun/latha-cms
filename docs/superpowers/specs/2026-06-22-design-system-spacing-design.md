# Design System — Spacing, Grid, Typography & Layout

**Date:** 2026-06-22
**Status:** Approved, ready for implementation

## Problem

`packages/ui/src/styles/globals.css` defines tokens for color, radius, shadow,
and fonts — but **no spacing scale, no typography scale, and no consumed layout
tokens**. Spacing is hardcoded ad-hoc across components with magic numbers that
do not agree with each other:

- `AdminShell` content uses `p-6` + `max-w-6xl`, but a `--content-max: 72rem`
  token exists and is **never used**.
- `Sidebar` hardcodes `w-64`, but `--sidebar-width: 16rem` exists and is
  **never used**.
- `Topbar` hardcodes `h-14`, but `--header-height: 3.5rem` exists and is
  **never used**.
- Card uses `gap-6 py-6 px-6`; CardHeader gap `1.5`; Field gap `1.5`;
  EntityForm column gap `5`, section gap `6`, button row gap `3` — no rationale
  tying these together.
- Section labels use a raw `text-[0.7rem]`; there is no typographic scale.

The intent existed (the unused layout tokens prove it) but was never wired up,
and spacing diverged.

## Decisions

- **Scope:** Add the missing scales AND wire the already-defined-but-unused
  layout tokens; refactor layout/shell/card/form/view code to consume them.
- **Spacing model:** Layered — numeric primitive scale + semantic aliases on
  top.
- **Consumption:** Tailwind v4 `@theme inline` utilities (`gap-section`,
  `p-card`, `text-h2`, etc.) — idiomatic for this codebase, autocompletes.
- **Rhythm:** Keep the existing 4px Tailwind rhythm; introduce a deliberate
  typography scale; tighten inconsistent gaps to scale steps. Lowest churn.

## Token Architecture (globals.css)

### Layer A — primitive spacing scale (4px rhythm)

```
--space-0: 0;        --space-px: 1px;
--space-1: 0.25rem   (4px)    --space-2: 0.5rem   (8px)
--space-3: 0.75rem   (12px)   --space-4: 1rem     (16px)
--space-5: 1.25rem   (20px)   --space-6: 1.5rem   (24px)
--space-8: 2rem      (32px)   --space-10: 2.5rem  (40px)
--space-12: 3rem     (48px)   --space-16: 4rem    (64px)
```

Mirrors Tailwind's own scale so existing classes keep working and the rhythm is
documented.

### Layer B — semantic aliases (intent-named, built on Layer A)

```
--space-page:      var(--space-6)   /* page/content padding        */
--space-section:   var(--space-8)   /* gap between page sections   */
--space-card:      var(--space-6)   /* card inner padding          */
--space-card-gap:  var(--space-4)   /* gap inside a card           */
--space-field-gap: var(--space-2)   /* label <-> control <-> help  */
--space-form-gap:  var(--space-5)   /* gap between form fields     */
--space-inline:    var(--space-2)   /* icon <-> text, button rows  */
--space-stack:     var(--space-1)   /* nav item lists              */
--space-sidebar:   var(--space-4)   /* sidebar inner padding       */
```

Exposed via `@theme inline` so they become utilities: `p-card`, `gap-section`,
`gap-field`, `gap-form`, `gap-inline`, `gap-stack`, `p-page`, `p-sidebar`.

### Typography scale

Exposed as `text-*` utilities (size + line-height; weight applied where it is
intrinsic to the role):

```
--text-display: 1.875rem / 2.25rem, 600   /* page hero (rare)          */
--text-h1:      1.5rem  / 2rem,     600   /* page title                */
--text-h2:      1.25rem / 1.75rem,  600   /* card / section title      */
--text-h3:      1rem    / 1.5rem,   600   /* sub-section / topbar title */
--text-body:    0.875rem/ 1.25rem,  400   /* default UI text (14px)    */
--text-small:   0.8125rem/1.25rem,  400   /* secondary / table cells   */
--text-caption: 0.75rem / 1rem,     500   /* helper, descriptions      */
--text-label:   0.7rem  / 1rem,     500   /* tracked uppercase eyebrow */
```

`text-sm` / `text-xs` remain valid (standard Tailwind); components are steered
to the semantic names where intent is clear (titles, labels, captions).

### Wire the existing layout tokens

- `--sidebar-width: 16rem` → Sidebar `w-(--sidebar-width)` (replaces `w-64`)
- `--header-height: 3.5rem` → Topbar `h-(--header-height)` (replaces `h-14`)
- `--content-max: 72rem` → AdminShell `max-w-(--content-max)` (replaces
  `max-w-6xl`)

`72rem == max-w-6xl` and `16rem == w-64`, so these are zero-visual-change — they
just make the tokens authoritative and remove magic numbers.

## Component Refactor Map

No intended visual regressions; values match or deliberately tighten current
ones.

**Shell**
- `AdminShell.tsx`: `p-6` → `p-page`; `max-w-6xl` → `max-w-(--content-max)`;
  children wrapped in `gap-section` vertical rhythm.
- `Sidebar.tsx`: `w-64` → `w-(--sidebar-width)`; `p-4` → `p-sidebar`; nav
  `gap-1` → `gap-stack`; section label `text-[0.7rem]...tracking-wider` →
  `text-label`.
- `Topbar.tsx`: `h-14` → `h-(--header-height)`; `px-6` → `px-page`; title →
  `text-h3`; actions `gap-2` → `gap-inline`.

**Card primitive** (`ui/card.tsx`)
- `py-6`/`px-6` → `py-card`/`px-card`; `gap-6` → `gap-card`; CardHeader
  `gap-1.5` → `gap-field`; `CardTitle` → `text-h2`; `CardDescription` →
  `text-caption text-muted-foreground`.

**Forms**
- `EntityForm.tsx`: grid `gap-6` → `gap-section`; column `gap-5` → `gap-form`;
  footer `gap-3` → `gap-inline`.
- `Field.tsx`: `gap-1.5` → `gap-field`; helper/error `text-xs` → `text-caption`.

**Views**
- `CollectionList.tsx`: empty-state `p-8` → `p-card` + `text-small`.

Lower-level `ui/*` primitives (button, input, select, etc.) are left as-is —
their internal padding is part of the component identity and is already
consistent.

## Verification

- `pnpm build` — confirm Tailwind generates the new utilities, nothing breaks.
- Run playground dev server; screenshot admin shell + a form view; confirm
  spacing reads as intentional and consistent.
- Add `packages/ui/DESIGN.md` documenting the primitives, semantic aliases,
  type scale, and "when to use which".

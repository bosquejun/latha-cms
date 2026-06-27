# Latha Design System

Tokens live in `src/styles/globals.css` and are exposed as Tailwind v4
utilities via `@theme inline`. Always prefer a semantic utility over a raw
number.

## Spacing

Layer A — primitive 4px rhythm: `--space-1` (4px) ... `--space-16` (64px).
Use these only when no semantic alias fits.

Layer B — semantic aliases (use these by default):

| Utility        | Value | Use for                                      |
| -------------- | ----- | -------------------------------------------- |
| `p-page`       | 24px  | page / content padding                       |
| `mb-page-gap`  | 24px  | gap between PageHeader and page content      |
| `p-sidebar`    | 16px  | sidebar inner padding                        |
| `p-card`       | 24px  | card inner padding                           |
| `p-empty`      | 64px  | empty / placeholder state padding            |
| `gap-section`  | 32px  | between page sections                        |
| `gap-card`     | 16px  | inside a card                                |
| `gap-group`    | 12px  | within a component row (title + actions row) |
| `gap-form`     | 20px  | between form fields                          |
| `gap-field`    | 8px   | label / control / helper                     |
| `gap-inline`   | 8px   | icon-text, button rows                       |
| `gap-stack`    | 4px   | nav item lists                               |
| `gap-tight`    | 6px   | compact atom padding (dropdown items, tabs)  |

(`p-*` utilities also come as `px-*` / `py-*` / `pt-*` etc.; spacing aliases
also produce `gap-*` and `m-*`.)

## Container awareness

Padded block containers (e.g. `Card`, `AdminShell <main>`) declare their
horizontal padding as an inheritable CSS variable:

```
[--container-px:var(--space-card)]   ← set on the container
```

Children that need to break out of that padding (full-bleed tables, dividers,
images) apply the `bleed-x` utility:

```jsx
<CardContent>
  <Table className="bleed-x" />  {/* extends to the card's inner border */}
</CardContent>
```

`bleed-x` expands to `margin-inline: calc(-1 * var(--container-px, 0px))`.
Because CSS custom properties cascade, nested containers override the variable
for their own subtree automatically.

## Typography

| Utility        | Size / line-height | Use for                |
| -------------- | ------------------ | ---------------------- |
| `text-display` | 30 / 36            | page hero (rare)       |
| `text-h1`      | 24 / 32            | page title             |
| `text-h2`      | 20 / 28            | card / section title   |
| `text-h3`      | 16 / 24            | sub-section, topbar    |
| `text-body`    | 14 / 20            | default UI text        |
| `text-small`   | 13 / 20            | secondary, table cells |
| `text-caption` | 12 / 16            | helper, descriptions   |
| `text-label`   | 11.2 / 16          | tracked uppercase eyebrow |

Apply color (`text-muted-foreground`) and weight (`font-semibold`) on top of
the size utility as needed.

## Compliance

**All non-primitive components must use semantic tokens** — shell components,
module pages, admin views, custom widgets, and playground files.

**Exempt:** `packages/ui/src/components/ui/` — shadcn primitive atoms (button,
input, badge, card, etc.). Their internal padding is part of their visual design
contract, not layout composition.

The ESLint rule `design-system/no-raw-spacing` (defined in `eslint.config.mjs`
at the repo root) enforces this automatically. It checks `className` strings and
`cn(...)` call arguments in `.tsx` files, warns when a semantic token exists for
a raw numeric class, and skips the exempt directory.

Run the check across all packages:

```sh
pnpm lint
```

The rule fires as a **warning** so existing regressions surface without breaking CI
immediately. Treat every new warning as a token violation to fix before merging.

---

## Layout tokens

`w-(--sidebar-width)` (16rem), `h-(--header-height)` (3.5rem),
`max-w-content-max` (72rem). These are authoritative — do not hardcode
`w-64` / `h-14` / `max-w-6xl`.

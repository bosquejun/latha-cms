# Latha Design System

Tokens live in `src/styles/globals.css` and are exposed as Tailwind v4
utilities via `@theme inline`. Always prefer a semantic utility over a raw
number.

## Spacing

Layer A — primitive 4px rhythm: `--space-1` (4px) ... `--space-16` (64px).
Use these only when no semantic alias fits.

Layer B — semantic aliases (use these by default):

| Utility       | Value | Use for                          |
| ------------- | ----- | -------------------------------- |
| `p-page`      | 24px  | page / content padding           |
| `p-sidebar`   | 16px  | sidebar inner padding            |
| `p-card`      | 24px  | card inner padding               |
| `gap-section` | 32px  | between page sections            |
| `gap-card`    | 16px  | inside a card                    |
| `gap-form`    | 20px  | between form fields              |
| `gap-field`   | 8px   | label / control / helper         |
| `gap-inline`  | 8px   | icon-text, button rows           |
| `gap-stack`   | 4px   | nav item lists                   |

(`p-*` utilities also come as `px-*` / `py-*` / `pt-*` etc.; spacing aliases
also produce `gap-*` and `m-*`.)

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

## Layout tokens

`w-(--sidebar-width)` (16rem), `h-(--header-height)` (3.5rem),
`max-w-content-max` (72rem). These are authoritative — do not hardcode
`w-64` / `h-14` / `max-w-6xl`.

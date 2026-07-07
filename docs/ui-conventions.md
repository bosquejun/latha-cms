# Admin UI Conventions

The authoritative rules for buttons, destructive actions, confirmations, and
empty states across the admin. `@latha/ui` supplies the primitives; every view
in `@latha/admin-sdk`, `@latha/start`, and module admin extensions follows the
same vocabulary so screens read as one product.

---

## Button vocabulary

| Action | Variant / size | Example |
|---|---|---|
| Create / New (page-level primary action) | `default` (primary), with a leading `<Plus />` | `+ New` in `PageHeader` actions, empty-state CTAs |
| Edit / navigate to a record | `ghost` icon button in rows; the row title is also a link | pencil icon in `EntityList` rows |
| Delete / remove / revoke (triggering control) | `destructive-subtle` | trash icon in table rows, `Delete` in the form toolbar |
| Confirming a destructive action (dialog only) | `destructive` (solid) | the `Delete` button inside `ConfirmDialog` |
| Cancel inside a dialog | `outline` | `ConfirmDialog`, create dialogs |
| Cancel inline (form toolbar, inline editors) | `ghost` | `EntityForm` toolbar |
| Secondary in-form actions (add item, pagination) | `outline` | `Add item` in `ArrayField`, `Previous`/`Next` |

Rules:

- **Solid `destructive` appears in exactly one place:** the confirming button of
  a confirmation dialog. Everywhere else destructive actions use
  `destructive-subtle` so screens aren't shouting red.
- **Table/grid row actions are icon buttons only** (`size="icon-sm"`), never
  text buttons. Every icon button carries an `aria-label` (specific to the row,
  e.g. `Delete Hello World`) and a `title` tooltip.
- **One primary button per view.** `default` is reserved for the single main
  action (create, save, confirm).
- Buttons with async work use the `loading` prop instead of hand-rolled
  spinners; it disables the button and prefixes a `Spinner`.

## Confirmations

All destructive actions confirm through `ConfirmDialog` from `@latha/ui` —
never `window.confirm`, never a hand-rolled overlay.

- The **triggering** control is `destructive-subtle`; the **confirming** button
  inside the dialog is solid `destructive`; Cancel is `outline`.
- Confirmation lives in the component that renders the trigger (list views own
  their row-delete dialog; `@latha/start`'s `EditView` owns the form-delete
  dialog). Callers of `EntityListProps.onDelete` must **not** stack a second
  confirm on top — the list renderer has already confirmed.
- Non-destructive guards (e.g. discard unsaved changes) use the same dialog
  without `destructive`.

## Empty states

Zero-data screens render `EmptyState` from `@latha/admin-sdk` — a dashed card
with an icon in a muted circle, a title, an optional description, and an
optional action. Never a bare `<p>` or an ad-hoc dashed box.

- The icon accepts both static `lucide-react` and animated `lucide-animated`
  components; animated icons play once on mount and re-play on hover. The
  default is an animated document stack, so most call sites can omit it.
- When the viewer can create the missing thing, include the primary create
  action (same `+ Label` button as the page header).
- Field-level empties (an empty `array`/`blocks` field) stay compact — a small
  dashed box — since `EmptyState` is a page/panel-level pattern.

## Sizing

- `size="sm"` for actions in headers, toolbars, and dense panels.
- `size="icon-sm"` (32px) for row/inline icon actions; plain `icon` (36px) for
  standalone icon buttons. Both keep a ≥40px hit target on touch via
  `pointer-coarse:` minimums — never shrink them with `h-*`/`w-*` overrides.

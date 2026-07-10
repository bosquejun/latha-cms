# Studio UI Conventions

The authoritative rules for buttons, destructive actions, confirmations, and
empty states across the Studio. `@kon10/ui` supplies the primitives; every view
in `@kon10/studio-sdk`, `@kon10/start`, and module Studio extensions follows the
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

All destructive actions confirm through `ConfirmDialog` from `@kon10/ui` —
never `window.confirm`, never a hand-rolled overlay.

- The **triggering** control is `destructive-subtle`; the **confirming** button
  inside the dialog is solid `destructive`; Cancel is `outline`.
- Confirmation lives in the component that renders the trigger (list views own
  their row-delete dialog; `@kon10/start`'s `EditView` owns the form-delete
  dialog). Callers of `EntityListProps.onDelete` must **not** stack a second
  confirm on top — the list renderer has already confirmed.
- Non-destructive guards (e.g. discard unsaved changes) use the same dialog
  without `destructive`.

## Empty states

Zero-data screens render `EmptyState` from `@kon10/studio-sdk` — a dashed card
with an icon in a muted circle, a title, an optional description, and an
optional action. Never a bare `<p>` or an ad-hoc dashed box.

- The icon accepts both static `lucide-react` and animated `lucide-animated`
  components; animated icons play once on mount and re-play on hover. The
  default is an animated document stack, so most call sites can omit it.
- When the viewer can create the missing thing, include the primary create
  action (same `+ Label` button as the page header).
- Field-level empties (an empty `array`/`blocks` field) stay compact — a small
  dashed box — since `EmptyState` is a page/panel-level pattern.

## Loading & feedback

- **Page/panel-level initial loads** render `LoadingState` from
  `@kon10/studio-sdk` — a centered spinner with an accessible status role —
  never a bare `Loading…` paragraph. Views with a known layout (e.g. the roles
  master-detail) may render `Skeleton`s instead.
- **In-flight button work** uses the Button `loading` prop (spinner + disable),
  not a hand-rolled `<Spinner />` child.
- **Every successful mutation confirms with `toast.success`** ("Changes
  saved.", "Deleted.", "Role created.") unless the UI already shows the result
  modally (e.g. the one-time API-key token dialog). Failures surface with
  `toast.error` carrying the server message. The `Toaster` is mounted once, in
  `StudioShell`.
- **Field-level fetches** (relationship options, media doc lookups) show a
  small inline `Spinner` in place of the control.

## Pagination

List footers use `Pagination` from `@kon10/ui` — never a hand-rolled bar.

- Layout: range summary on the left ("26–50 of 132"), icon prev/next controls
  (`icon-sm` outline chevrons with `aria-label`s) around a "Page X of Y"
  indicator on the right.
- Offset-based, matching the `page` RPC envelope: pass `total`, `offset`,
  `pageSize`, and `onOffsetChange`; pass `busy` while a page is in flight so
  the controls disable instead of double-firing.
- The component renders nothing when everything fits on one page — mount it
  unconditionally below the list card.
- Deleting the last row of a trailing page steps back a page rather than
  showing an empty one (see `ListView`).

## Mobile & responsive

- **Tables become stacked cards below `md`.** The pattern (from `EntityList`,
  mirrored by the API-keys table): a `<ul>` with `divide-y`, one card per row —
  tappable title on top, secondary columns as label/value pairs, row actions as
  icon buttons in the corner. Never ship a data table whose only phone
  affordance is horizontal panning.
- **Master-detail pages** (roles) make the list the page on phones; opening an
  item swaps to the detail as a subpage with a back link. Desktop shows both
  panes via `PageLayout`.
- **`PageLayout` panels stack** vertically below `lg` and only then arrange
  into columns; form sidebar fields follow the main column on phones.
- **The form toolbar** splits into two rows below `sm`: actions right-aligned
  on top, section tabs stretched into a full-width segmented control beneath.
- **Touch targets**: every interactive control keeps a ≥40px hit area on
  coarse pointers via `pointer-coarse:min-*` (baked into Button sizes and
  sidebar rows) — do not undo it with fixed `h-*`/`w-*` overrides.
- **Hover-revealed actions must not be hover-only**: reveal on focus-visible
  and force visible on `pointer-coarse:` (see the media grid delete button).
- Dialogs are already phone-safe (`w-[calc(100%-2rem)]`, `max-h` with internal
  scroll, footer buttons stack primary-first below `sm`) — don't override
  their width with fixed values.

## Sizing

- `size="sm"` for actions in headers, toolbars, and dense panels.
- `size="icon-sm"` (32px) for row/inline icon actions; plain `icon` (36px) for
  standalone icon buttons. Both keep a ≥40px hit target on touch via
  `pointer-coarse:` minimums — never shrink them with `h-*`/`w-*` overrides.

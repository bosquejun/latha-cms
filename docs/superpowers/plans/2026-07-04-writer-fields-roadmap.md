# Writer Fields & UX — Phased Roadmap

**Goal:** Take LathaCMS from today's minimal `posts` collection (`title`, `slug`,
`content`, `status`, `views`) to the full article/blog authoring experience —
featured images, byline, taxonomy, SEO metadata, editorial workflow, and the
UX polish that goes with it — without violating the package boundaries in
`CLAUDE.md`.

This doc sequences the work into phases and settles the architecture question
raised at kickoff (module-first vs. plugin/extension-first) once, so every
later phase plan can point back here instead of re-litigating it. Each phase
gets its own task-by-task implementation plan (in this same directory) when
it's picked up — this doc is the map, not the turn-by-turn directions.

---

## Architecture decision: module-first *and* extension-first — split by layer

This isn't an either/or per feature. It's two rules applied consistently:

1. **Domain data, entities, and field types are module-first.** Any new
   capability with its own storage shape or validation logic gets a real
   `@latha/*` package under `packages/modules/*`, exactly like `@latha/auth`,
   `@latha/users`, `@latha/content` today. `CLAUDE.md`'s package table already
   names this module for media (`@latha/media` — "`MediaModule`, storage
   adapters, media-specific field type"), so there's no ambiguity to resolve
   for this initiative: media is a module, not an admin-sdk plugin bolted onto
   an existing package.

2. **Admin UI is extension-first**, using the module-admin-ui-contract
   machinery already built (`docs/superpowers/plans/2026-06-25-module-admin-ui-contract.md`):
   a module ships a `src/admin/{fields,pages,widgets,settings,dashboard}`
   convention folder, exposes it as `<pkg>/admin`, and points to it with
   `Module.admin.ui`. `@latha/auth` already proved this pattern by moving
   `RolesPermissions` out of `@latha/start` and into `@latha/auth/admin`.
   Media's upload dropzone, picker, and library view follow the same route —
   `@latha/admin-sdk` stays generic (field-renderer *contract*, not concrete
   renderers) and never learns what a "media" or "SEO preview" is.

Net effect: `@latha/media` owns the `media` entity + field type + storage
adapter (module-first). `@latha/media/admin` owns the picker/dropzone/library
UI (extension-first). Nothing new is added to `@latha/admin-sdk` core except
generic, reusable layout primitives that any module's UI can use (accordion
group, pill/badge, sticky action bar) — those already partially exist in
`@latha/ui` and get extended there, not in admin-sdk, per the "pure design
system primitives" boundary.

---

## Phases

### Phase 0 — Media module foundation *(next up)*
New `@latha/media` package: `media` entity (`Collection`, cardinality
`many`), a `media` field type (`{ type: 'media' }` → stores the media doc id,
same shape as `taxonomy`/`relationship`), a `StorageAdapter` contract
(separate from `@latha/storage`'s `DBAdapter` — that package is relational
metadata only, no blob storage today) with a local-disk implementation, an
upload transport (binary can't go through the JSON-only `/__latha/rpc` route
as-is — needs a small dedicated file route or base64-through-RPC as a
stopgap), and `@latha/media/admin` (upload dropzone + picker field renderer,
library list view). Unblocks every field below that needs an image.

### Phase 1 — Article content model
Extend the `posts` `Collection` in `apps/playground/latha.config.ts`:
`excerpt` (`text`), `category` (`taxonomy`, single), `tags` (new flat
`Taxonomy` entity, `many: true`), `featuredImage` (`media`), `author`
(`relationship` → `users`), `publishedAt` (`date`), and an `seo` composite
(`group` of `metaTitle`/`metaDescription`/`ogImage`). No core or field-registry
changes — every type used here already exists once Phase 0 lands.

### Phase 2 — Editorial workflow
Widen `status` to `draft` / `in_review` / `scheduled` / `published` /
`archived`; give `publishedAt` real scheduling semantics (a hook that treats
"scheduled + publishedAt <= now" as effectively published on read, since
there's no background job runner yet — a true scheduler is a separate,
larger piece of infra); add `reviewer` (`relationship` → `users`) and
internal editorial notes. Depends on Phase 1's fields existing.

### Phase 3 — Admin UX polish
Generic, reusable admin-sdk/ui work that benefits every collection, not just
posts: collapsible field groups (SEO accordion), a status pill in list views,
a sticky save/status bar, keyboard shortcuts (`Cmd+S`, `/` block insert),
preview mode. Lives in `@latha/admin-sdk` + `@latha/ui` because it's generic
UX, not content-domain logic — consistent with the "what belongs in core/
admin-sdk" test in `CLAUDE.md`.

### Phase 4 — Revisions & autosave
The biggest architectural lift: version history, diff view, autosave state.
Needs its own design pass before a task plan, because it touches
`@latha/core`'s operations layer and `@latha/storage`'s migration story
(new revision tables) — not something to fast-follow casually. Flagged here
so it isn't forgotten, not scheduled yet.

### Phase 5 — Related content, series, localization
Lowest priority. Mostly `relationship`-field composition on top of what
Phase 1 already ships (related-articles picker, series grouping,
translation-group linking). No new architecture expected.

---

## Dependency chain

```
Phase 0 (media module)
   └─▶ Phase 1 (content model, needs `media` field + tags taxonomy)
          └─▶ Phase 2 (workflow, needs Phase 1's fields)
   └─▶ Phase 3 (UX polish — independent of Phase 1/2, can run in parallel)
Phase 4 (revisions) — independent, needs its own design doc first
Phase 5 (related/series/i18n) — after Phase 1
```

## Open risks to flag before Phase 0's task plan is written

- **Upload transport**: `/__latha/rpc` (`packages/start/src/routes/rpc.ts`) is
  JSON-only today. Decide file-route-vs-base64 in Phase 0's own plan, not here.
- **Storage adapter scope**: local-disk only for Phase 0; S3-compatible adapter
  is a fast-follow, not a blocker for the field type or admin UI existing.
- **Phase 4** genuinely needs a design doc (`docs/superpowers/specs/`) before
  any implementation plan — do not let it get pulled forward opportunistically
  while doing Phase 0-3 work.

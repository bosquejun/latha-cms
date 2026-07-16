# @kon10/slug — Slug Plugin

A cross-cutting **plugin** (not a module): adds a template-based `slug` field type with uniqueness, optional nesting/paths, and Studio UX to any entity that opts in — whichever module contributed the entity.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules and the module-vs-plugin distinction.

## Owns

- **`slugPlugin()`** — `plugin.ts`: the `Plugin`. At `onInit` (after all module `onInit`s, before `migrate`) it registers the `slug` field type, compiles each field's `from` template against sibling fields (stamping `tokens`), and unshifts `beforeCreate`/`beforeUpdate` hooks (closing over `cms.db`) for uniqueness — so user hooks observe the final slug.
- **Field + builder** — `field.ts` (`slugFieldConfigSchema`, `slugFieldEntry`), `builders.ts` (`slug`).
- **Slug logic** — `slugify.ts` (string → slug), `template.ts` (`parseTemplate`, `compileTokens`), `hooks.ts` (`createSlugHooks`, uniqueness + nested path cascade).
- **Studio UI** — `studio/fields/slug-field.tsx` via the `./studio` barrel.

## Nested slugs

For `nested` slug fields the plugin validates the parent (single-valued self-referential reference), injects a hidden unique full-path field, flips the leaf's own `unique` off (the path column carries the UNIQUE backstop), and wires an `afterUpdate` descendant-path cascade. Misconfiguration throws **at boot** — config errors surface early.

## Conventions specific to slug

- **Detection is by field _type_ `'slug'`, never by field _name_.** A hand-rolled `slug: text()` field is left untouched. Top-level fields only — slug fields nested in `group`/`array` are out of scope.
- As a plugin it augments *other modules'* entities; it owns no entities of its own.
- The Studio renderer interprets the exact same compiled `tokens` the backend stamped — keep the two in sync.

## Tests

Strong coverage: `slugify`, `template`, `hooks`, `plugin`, and `integration.test.ts` via `node:test` against `dist/`.

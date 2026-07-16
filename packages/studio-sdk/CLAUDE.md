# @kon10/studio-sdk — Studio SDK

The CMS-aware Studio: the app shell, the typed RPC client, field renderers, auto-generated list/edit views, and the extension system. Runners (`@kon10/start`) mount it; modules/plugins contribute UI into it.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **Client** — `client/` (`createKon10Client`, `Kon10Client`, `Kon10Provider`, `useKon10`, RPC path constants, `default-rpc.ts`, upload). The browser-side typed transport to the runner's RPC endpoint.
- **Field rendering** — `fields/registry.tsx` + `fields/renderers/*` (one renderer per built-in type, plus the Lexical rich-text editor under `renderers/lexical/`). `registerFieldRenderer` lets modules override/add. `show-if.ts`, `formSchema.ts`, `defaults.ts`, `layout.ts` drive form behavior from field config + `meta`.
- **Extension system** — `extensions/` (`defineStudioExtensions`, zones, `Slot`, `collect`, registry): the contract by which modules/plugins inject widgets, pages, settings, field renderers, list views, and nav links.
- **Shell** — `shell/*` (`StudioShell`, nav, layouts, top-nav, sidebar, theme, responsive hooks): the chrome every view renders inside.
- **Schema** — `schema.ts`: derives the Studio's display view of entities/fields (including the local `'collection' | 'document' | 'taxonomy'` display vocabulary from the opaque `kind` tag).

## Must never contain

- Business logic or persistence logic. It reads the config/schema and talks RPC; it never decides access, validates domain rules, or touches a database.

## Conventions specific to studio-sdk

- **Reads field `meta`, never invents field types.** Renderers key off registered field types + the `FieldMeta` bag (`label`, `description`, `placeholder`, `hidden`, `sidebar`); it does not own field definitions (core does).
- Derives its display vocabulary from `kind` locally — it must **not** import entity-kind names from core (core has none).
- Uses `@kon10/ui` for all primitives; Studio components add CMS meaning on top of pure UI. Don't reach into `@kon10/ui` internals.
- Modules contribute UI through the **extension registry**, never by importing studio-sdk internals directly.

## Tests

`node:test` against `dist/` for logic (`schema`, `client`, `extensions/collect`, `fields/color`). Interactive flows are covered by the playground E2E suite.

# @kon10/ui — Design System

Pure shadcn/ui primitives and design tokens. **Zero CMS knowledge.** This is the bottom of the stack — nothing here knows what a collection, field, or document is.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **Primitives** — `components/ui/*` (shadcn/ui: `button`, `dialog`, `input`, `select`, `table`, `tabs`, `sheet`, `dropdown-menu`, `status-badge`, `spinner`, …).
- **Composed helpers** — `components/*` (`ConfirmDialog`, `CopyButton`, `Field`, `Pagination`, `PasswordInput`, `SelectInput`): still domain-agnostic, just higher-level.
- **Tokens + styles** — `styles/globals.css` (exported as `@kon10/ui/styles.css`), bundled Geist fonts, `lib/utils.ts` (`cn`).

## Must never contain

- Any CMS concept whatsoever — no field types, no entity awareness, no RPC, no config knowledge. A `TextField` renderer belongs in `@kon10/studio-sdk`; a plain `<Input>` belongs here.

## Conventions specific to ui

- Props-in / events-out. Components take data and callbacks; they never fetch, never know about the Studio.
- Keep it swappable: someone should be able to reuse `@kon10/ui` in a non-Kon10 app with no changes.
- Follow the existing shadcn/ui structure under `components/ui/` when adding primitives; put anything with opinion in `components/`.

## Note

No `test` script — this is presentational. Visual behavior is exercised through `@kon10/studio-sdk` and the playground E2E suite.

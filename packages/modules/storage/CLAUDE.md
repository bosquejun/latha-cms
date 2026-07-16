# @kon10/storage — DBAdapters

`DBAdapter` implementations: Turso (libsql) and Postgres/Supabase. This is the persistence backend the kernel's operations layer talks to.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules, and [`docs/concepts/migrations.md`](../../docs/concepts/migrations.md) for the migration contract.

## Owns

- **Adapters** — `adapters/turso.ts` (`tursoAdapter`, `TursoAdapterOptions`) and `adapters/postgres.ts`: implement core's `DBAdapter` contract (query + `migrate`).
- **Schema generation + reconciliation** — `schema/generator.ts`, `schema/alter.ts`, `schema/dialect.ts`, and marshaling (`schema/marshal.ts`, `schema/pg-marshal.ts`): map entity definitions to tables/columns per dialect and (un)marshal row values.

## The migration contract (non-negotiable)

`migrate()` reconciles **additively only**:

- `CREATE TABLE IF NOT EXISTS` for new entities.
- `ALTER TABLE ADD COLUMN` for new fields.
- Renames, retypes, and removals are **never applied** — drift is only *warned* about, never destructively resolved.

Do not add code that drops or retypes columns during migration. Data safety is the whole point of this boundary.

## Must never contain

- Application logic. An adapter knows about tables, columns, dialects, and marshaling — never about auth, content, or what a row *means*.

## Conventions specific to storage

- Keep dialect differences behind `schema/dialect.ts` and the per-dialect marshalers; the adapters share the additive-migration and query logic.
- Both adapters must satisfy the same core `DBAdapter` contract — a change to one usually needs the matching change (and tests) in the other.

## Tests

Dialect and migration behavior is well-covered: `adapters/turso.{drift,marshal,migrate,query}.test.ts`, `schema/{alter,dialect}.test.ts` via `node:test` against `dist/`.

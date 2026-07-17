# @kon10/storage — DBAdapters

`DBAdapter` implementations: Turso (libsql) and Postgres/Supabase. This is the persistence backend the kernel's operations layer talks to.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules, and [`docs/concepts/migrations.md`](../../docs/concepts/migrations.md) for the migration contract.

## Owns

- **Shared adapter** — `adapters/kysely-adapter.ts` (`KyselyAdapter`): the one implementation of core's `DBAdapter` contract (query + `migrate`), written against **Kysely in dynamic mode** (`Kysely<any>` + `db.dynamic.ref`, since entities have no static schema). Query building lives here once and Kysely renders the dialect-correct SQL — the previous per-adapter `buildSelect`/`buildWhere`/INSERT/UPDATE duplication is gone.
- **Adapters** — `adapters/turso.ts` (`tursoAdapter`, `TursoAdapterOptions`) and `adapters/postgres.ts` (`postgresAdapter`, `PostgresAdapterOptions`): thin factories that pick a Kysely dialect (Turso's first-party `@libsql/kysely-libsql`; Kysely's official `PostgresDialect` over the `pg` driver) and hand it to `KyselyAdapter`.
- **Schema generation + reconciliation** — `schema/generator.ts` and marshaling (`schema/marshal.ts`, `schema/pg-marshal.ts`): map entity definitions to tables/columns per dialect and (un)marshal row values. Kysely **executes** the DDL strings `generator.ts` produces (`sql.raw`) — it does not generate them; the additive-migration contract stays in `generator.ts`. Live columns come from Kysely's `introspection.getTables()`, which unifies the old SQLite `PRAGMA table_info` / Postgres `information_schema` split.
- **Query analytics** — `KyselyAdapter` wraps every DB round-trip in a `kon10.db.*` span through the kernel's `Tracer` (assigned to `.tracer` at boot, after plugin `onInit`). These nest under the operation-level `kon10.find` / `kon10.create` / … spans the operations layer emits, isolating query time from access/hook/validation time. Default `noopTracer` → zero cost.

## The migration contract (non-negotiable)

`migrate()` reconciles **additively only**:

- `CREATE TABLE IF NOT EXISTS` for new entities.
- `ALTER TABLE ADD COLUMN` for new fields.
- Renames, retypes, and removals are **never applied** — drift is only *warned* about, never destructively resolved.

Do not add code that drops or retypes columns during migration. Data safety is the whole point of this boundary.

## Must never contain

- Application logic. An adapter knows about tables, columns, dialects, and marshaling — never about auth, content, or what a row *means*.

## Conventions specific to storage

- Query and migration logic is written **once** in `KyselyAdapter`; the concrete adapters only differ in the Kysely dialect they construct. Dialect differences that Kysely doesn't abstract away live in exactly two places: the per-dialect DDL in `schema/generator.ts` and the per-dialect marshalers (`marshal.ts` for SQLite, `pg-marshal.ts` for Postgres). Don't reintroduce per-adapter query code.
- Keep marshaling dialect-specific: libsql returns SQLite-native values (0/1 booleans, JSON as TEXT); `pg` returns native booleans/numbers/JSONB. This is driver-inherent — no query builder erases it.
- Both factory adapters flow through the same `KyselyAdapter`, so behavior parity is structural; still add a matching test when a change is dialect-sensitive.

## Tests

Dialect and migration behavior is well-covered: `adapters/turso.{drift,marshal,migrate,query}.test.ts`, `schema/{alter,dialect}.test.ts` via `node:test` against `dist/`.

---
'@kon10/storage': minor
'@kon10/core': minor
---

refactor(storage): consolidate the DB adapters onto Kysely, with query-level analytics

Both `DBAdapter` implementations now run on a single shared adapter
(`KyselyAdapter`) built on [Kysely](https://kysely.dev). Because Kon10 entities
are declared at runtime there is no static schema, so the adapter uses Kysely's
dynamic mode (`Kysely<any>` + `db.dynamic.ref`) and builds every query from the
runtime `TablePlan`. The upshot: the query, pagination, and reconciliation logic
that used to be written twice — once per adapter, with hand-assembled `?`/`$n`
SQL strings — is now written once, and Kysely renders the dialect-correct SQL.

- `tursoAdapter` uses Turso's first-party `@libsql/kysely-libsql` dialect.
- `postgresAdapter` uses Kysely's official `PostgresDialect` over the `pg`
  driver, replacing the previous `postgres` (porsager) driver.

The migration contract is unchanged: `schema/generator.ts` still owns the
additive DDL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`, never
drop/retype; warn on drift) — Kysely only *executes* those strings. Live-column
introspection is unified through Kysely's `introspection.getTables()`, replacing
the separate SQLite `PRAGMA` and Postgres `information_schema` queries. Value
marshaling stays dialect-specific, as the driver storage shapes differ.

**Analytics.** `@kon10/core`'s `DBAdapter` gains an optional `tracer` seam,
which the kernel assigns during boot (after plugin `onInit`, so a plugin-
registered tracer such as `@kon10/sentry`'s is the one the adapter sees). The
adapter wraps each DB round-trip in a `kon10.db.*` span — a finer child of the
operation-level `kon10.find` / `kon10.create` / … spans, isolating query time
from access/hook/validation time. With the default `noopTracer` it costs
nothing. Adding the field is backward compatible: it is optional, so existing
`DBAdapter` implementations are unaffected.

**Breaking (Postgres):** `PostgresAdapterOptions` drops the porsager-specific
`prepare` option. `pg` uses unnamed prepared statements, which are already
compatible with Supabase's transaction pooler (pgBouncer), so no replacement is
needed.

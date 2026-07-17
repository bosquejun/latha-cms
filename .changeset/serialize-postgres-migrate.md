---
'@kon10/storage': patch
---

`postgresAdapter().migrate()` now serializes concurrent runs with a transaction-scoped advisory lock (`pg_advisory_xact_lock`). `CREATE TABLE IF NOT EXISTS` is not race-safe in Postgres — two connections can both pass the existence check and then collide inserting the table's implicit composite type into `pg_type`, failing with `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`. This surfaced on serverless platforms (e.g. Vercel) where several cold-start instances boot and migrate at once. The lock makes later migrations wait for the first, so `IF NOT EXISTS` becomes a genuine no-op; the transaction-scoped variant is used specifically so it works correctly behind Supabase's transaction pooler.

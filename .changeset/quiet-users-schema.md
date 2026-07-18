---
"@kon10/storage": patch
---

Scope PostgreSQL schema reconciliation to the active schema and make additive
column migrations idempotent. This prevents Supabase's `auth.users` table and
concurrent serverless boots from causing duplicate-column errors against the
application's `users` table.

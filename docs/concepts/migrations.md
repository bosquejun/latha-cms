# Migrations: what `migrate()` does — and doesn't

Kon10 has no migration files. At boot, the storage adapter reconciles the
database schema with the entities in your config (`db.migrate(entities)`).
That reconciliation is deliberately conservative:

## What it does

- **Creates missing tables** (`CREATE TABLE IF NOT EXISTS`) for new entities.
- **Adds missing columns** (`ALTER TABLE … ADD COLUMN`, always nullable) for
  fields added to an existing entity.
- **Warns about undeclared columns**: a live column no field declares is
  logged (`table "posts" has a column "views" that no field declares`) and
  left untouched.

## What it does NOT do

> ⚠️ **Everything below is silent schema drift** — the app keeps booting, and
> the mismatch only surfaces later as missing data or validation errors.

- **Renames.** Renaming a field creates a *new* column; the old column keeps
  the existing data and is never read again. To users this looks like data
  loss. If you must rename, copy the data yourself first (SQL) and then
  rename the field.
- **Type changes.** Changing a field's type does not retype the column.
  Existing values stay in the old representation; reads may fail Zod
  validation.
- **Removals.** Deleting a field never drops its column — you get the warning
  above, nothing more. Drop it manually when you're sure.
- **Constraint changes.** `required`, `unique`, min/max etc. are enforced by
  the Zod layer on writes, not retrofitted onto existing rows. Data written
  before the constraint may violate it.

## Practical guidance

- Additive changes (new entities, new fields) are always safe to deploy.
- Treat rename/retype/remove as a manual, two-step operation: migrate the
  data with your database's tools, then change the config.
- Boot with `KON10_LOG_LEVEL=debug` to see exactly which DDL the
  reconciliation ran.
- A first-class migration tool (diffing, generated migration files) is on the
  post-v1 roadmap.

/**
 * @latha/storage — DBAdapter implementations.
 *
 * Turso (SQLite over libsql) is the default and works locally via `file:` URLs.
 * Postgres (`postgresAdapter`, also serves Supabase) is supported too; MySQL
 * lands in a later phase.
 */

export { tursoAdapter, type TursoAdapterOptions } from './adapters/turso.js'
export {
  postgresAdapter,
  type PostgresAdapterOptions,
} from './adapters/postgres.js'
export {
  buildTablePlan,
  createTableSQL,
  type TablePlan,
  type ColumnPlan,
  type ColumnKind,
  type Dialect,
} from './schema/generator.js'

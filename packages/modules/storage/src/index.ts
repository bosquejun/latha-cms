/**
 * @latha/storage — Drizzle/libsql-backed DBAdapter implementations.
 *
 * Turso (SQLite over HTTP) is the default and works locally via `file:` URLs.
 * Postgres and MySQL adapters land in later phases.
 */

export { tursoAdapter, type TursoAdapterOptions } from './adapters/turso.js'
export {
  buildTablePlan,
  createTableSQL,
  type TablePlan,
  type ColumnPlan,
  type ColumnKind,
} from './schema/generator.js'

/**
 * @kon10/auth/admin — the auth module's admin-UI barrel.
 *
 * Collects this module's `src/admin/**` convention folders (same shape an app
 * uses under its own `src/admin/`) into a single `AdminExtensions`, which the
 * Start Vite plugin merges into the admin registry when `@kon10/auth` is present
 * in `kon10.config`. Client-only — never imported by the server entry.
 */
import { collectAdminExtensions, type AdminExtensions } from '@kon10/admin-sdk'

export const adminExtensions: AdminExtensions = collectAdminExtensions({
  widgets: import.meta.glob('./widgets/**/*.{tsx,jsx,ts,js}', { eager: true }),
  pages: import.meta.glob('./pages/**/*.{tsx,jsx,ts,js}', { eager: true }),
  dashboard: import.meta.glob('./dashboard/**/*.{tsx,jsx,ts,js}', { eager: true }),
  settings: import.meta.glob('./settings/**/*.{tsx,jsx,ts,js}', { eager: true }),
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
})

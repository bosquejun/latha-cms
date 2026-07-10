/**
 * @kon10/media/admin — the media module's admin-UI barrel.
 *
 * Collects this module's `src/admin/**` convention folders into a single
 * `AdminExtensions`, merged into the admin registry when `@kon10/media` is
 * present in `kon10.config`. Client-only — never imported by the server
 * entry (see the split tsconfig/package.json export).
 */
import { collectAdminExtensions, type AdminExtensions } from '@kon10/admin-sdk'

export const adminExtensions: AdminExtensions = collectAdminExtensions({
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
  lists: import.meta.glob('./lists/**/*.{tsx,jsx,ts,js}', { eager: true }),
})

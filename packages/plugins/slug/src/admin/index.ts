/**
 * @kon10/slug/admin — the slug plugin's admin-UI barrel.
 *
 * Collects `src/admin/**` convention folders into a single `AdminExtensions`,
 * merged into the admin registry via `Plugin.admin.ui` when `slugPlugin()` is
 * present in `kon10.config`. Client-only — never imported by the server entry
 * (see the split tsconfig/package.json export).
 */
import { collectAdminExtensions, type AdminExtensions } from '@kon10/admin-sdk'

export const adminExtensions: AdminExtensions = collectAdminExtensions({
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
})

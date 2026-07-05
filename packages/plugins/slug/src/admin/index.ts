/**
 * @latha/slug/admin — the slug plugin's admin-UI barrel.
 *
 * Collects `src/admin/**` convention folders into a single `AdminExtensions`,
 * merged into the admin registry via `Plugin.admin.ui` when `slugPlugin()` is
 * present in `latha.config`. Client-only — never imported by the server entry
 * (see the split tsconfig/package.json export).
 */
import { collectAdminExtensions, type AdminExtensions } from '@latha/admin-sdk'

export const adminExtensions: AdminExtensions = collectAdminExtensions({
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
})

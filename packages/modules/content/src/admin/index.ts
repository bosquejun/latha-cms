/**
 * @latha/content/admin — the content module's admin-UI barrel.
 *
 * Collects this module's `src/admin/**` convention folders into a single
 * `AdminExtensions`, merged into the admin registry when `@latha/content` is
 * present in `latha.config`. Client-only — never imported by the server entry
 * (see the split tsconfig/package.json export).
 */
import { collectAdminExtensions, type AdminExtensions } from '@latha/admin-sdk'

export const adminExtensions: AdminExtensions = collectAdminExtensions({
  fields: import.meta.glob('./fields/**/*.{tsx,jsx}', { eager: true }),
})

/**
 * Ambient types for the admin-extensions virtual module emitted by the
 * `lathaStart()` Vite plugin.
 *
 * Add `/// <reference types="@latha/start/virtual" />` once in your app (e.g. in
 * `src/router.tsx` or a `globals.d.ts`) to type the import:
 *
 *   import { adminExtensions } from 'virtual:latha/admin-extensions'
 */

declare module 'virtual:latha/admin-extensions' {
  import type { AdminExtensions } from '@latha/admin-sdk'
  /** Extensions auto-collected from the `src/admin/` convention folder. */
  export const adminExtensions: AdminExtensions
}

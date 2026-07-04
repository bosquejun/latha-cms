/**
 * Ambient types for the virtual modules emitted by the `lathaStart()` Vite
 * plugin.
 *
 * Add `/// <reference types="@latha/start/virtual" />` once in your app (e.g. in
 * `src/router.tsx` or a `globals.d.ts`) to type the imports:
 *
 *   import { adminExtensions } from 'virtual:latha/admin-extensions'
 *   import config from 'virtual:latha/config'
 */

declare module 'virtual:latha/admin-extensions' {
  import type { AdminExtensions } from '@latha/admin-sdk'
  /** Extensions auto-collected from the `src/admin/` convention folder. */
  export const adminExtensions: AdminExtensions
}

declare module 'virtual:latha/config' {
  import type { ResolvedConfig } from '@latha/core'
  /** Resolves to the consuming app's `latha.config` module. */
  const config: ResolvedConfig
  export default config
}

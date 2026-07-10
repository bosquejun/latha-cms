/**
 * Ambient types for the virtual modules emitted by the `kon10Start()` Vite
 * plugin.
 *
 * Add `/// <reference types="@kon10/start/virtual" />` once in your app (e.g. in
 * `src/router.tsx` or a `globals.d.ts`) to type the imports:
 *
 *   import { adminExtensions } from 'virtual:kon10/admin-extensions'
 *   import config from 'virtual:kon10/config'
 */

declare module 'virtual:kon10/admin-extensions' {
  import type { AdminExtensions } from '@kon10/admin-sdk'
  /** Extensions auto-collected from the `src/admin/` convention folder. */
  export const adminExtensions: AdminExtensions
}

declare module 'virtual:kon10/config' {
  import type { ResolvedConfig } from '@kon10/core'
  /** Resolves to the consuming app's `kon10.config` module. */
  const config: ResolvedConfig
  export default config
}

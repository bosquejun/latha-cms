/**
 * `virtual:latha/config` — resolved by the `lathaStart()` Vite plugin to the
 * consuming app's `latha.config` module. Imported only from the server-only RPC
 * route handler.
 */
declare module 'virtual:latha/config' {
  import type { ResolvedConfig } from '@latha/core'
  const config: ResolvedConfig
  export default config
}

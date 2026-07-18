/**
 * `virtual:kon10/config` — resolved by the `kon10Start()` Vite plugin to the
 * consuming app's `kon10.config` module. Imported only from the server-only RPC
 * route handler.
 */
declare module 'virtual:kon10/config' {
  import type { ResolvedConfig } from 'kon10'
  const config: ResolvedConfig
  export default config
}

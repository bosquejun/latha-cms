/**
 * Ambient types for the virtual modules emitted by the `kon10Start()` Vite
 * plugin.
 *
 * Add `/// <reference types="@kon10/start/virtual" />` once in your app (e.g. in
 * `src/router.tsx` or a `globals.d.ts`) to type the imports:
 *
 *   import { studioExtensions } from 'virtual:kon10/studio-extensions'
 *   import config from 'virtual:kon10/config'
 */

declare module 'virtual:kon10/studio-extensions' {
  import type { StudioExtensions } from '@kon10/studio-sdk'
  /** Extensions auto-collected from the `src/studio/` convention folder. */
  export const studioExtensions: StudioExtensions
}

declare module 'virtual:kon10/config' {
  import type { ResolvedConfig } from 'kon10'
  /** Resolves to the consuming app's `kon10.config` module. */
  const config: ResolvedConfig
  export default config
}

declare module 'virtual:kon10/studio-config' {
  import type { StudioBrandingConfig, StudioTelemetryNoticeConfig } from 'kon10'
  /**
   * Client-safe Studio config read from the app's `kon10.config` — the
   * serializable `studio.branding` + `studio.telemetryNotice` blocks. Wire it
   * into the provider: `<Kon10Provider branding={studioConfig.branding}
   * telemetryNotice={studioConfig.telemetryNotice} …>`.
   */
  export const studioConfig: {
    branding: StudioBrandingConfig
    telemetryNotice: StudioTelemetryNoticeConfig
  }
  export default studioConfig
}

/**
 * @kon10/auth/studio — the auth module's Studio-UI barrel.
 *
 * Collects this module's `src/studio/**` convention folders (same shape an app
 * uses under its own `src/studio/`) into a single `StudioExtensions`, which the
 * Start Vite plugin merges into the Studio registry when `@kon10/auth` is present
 * in `kon10.config`. Client-only — never imported by the server entry.
 */
import { collectStudioExtensions, type StudioExtensions } from '@kon10/studio-sdk'

export const studioExtensions: StudioExtensions = collectStudioExtensions({
  widgets: import.meta.glob('./widgets/**/*.{tsx,jsx,ts,js}', { eager: true }),
  pages: import.meta.glob('./pages/**/*.{tsx,jsx,ts,js}', { eager: true }),
  dashboard: import.meta.glob('./dashboard/**/*.{tsx,jsx,ts,js}', { eager: true }),
  settings: import.meta.glob('./settings/**/*.{tsx,jsx,ts,js}', { eager: true }),
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
})

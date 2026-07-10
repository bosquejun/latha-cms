/**
 * @kon10/media/studio — the media module's Studio-UI barrel.
 *
 * Collects this module's `src/studio/**` convention folders into a single
 * `StudioExtensions`, merged into the Studio registry when `@kon10/media` is
 * present in `kon10.config`. Client-only — never imported by the server
 * entry (see the split tsconfig/package.json export).
 */
import { collectStudioExtensions, type StudioExtensions } from '@kon10/studio-sdk'

export const studioExtensions: StudioExtensions = collectStudioExtensions({
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
  lists: import.meta.glob('./lists/**/*.{tsx,jsx,ts,js}', { eager: true }),
})

/**
 * @kon10/slug/studio — the slug plugin's Studio-UI barrel.
 *
 * Collects `src/studio/**` convention folders into a single `StudioExtensions`,
 * merged into the Studio registry via `Plugin.studio.ui` when `slugPlugin()` is
 * present in `kon10.config`. Client-only — never imported by the server entry
 * (see the split tsconfig/package.json export).
 */
import { collectStudioExtensions, type StudioExtensions } from '@kon10/studio-sdk'

export const studioExtensions: StudioExtensions = collectStudioExtensions({
  fields: import.meta.glob('./fields/**/*.{tsx,jsx,ts,js}', { eager: true }),
})

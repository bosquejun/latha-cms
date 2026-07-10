/**
 * Framework-owned `/studio/$` catch-all route. `Kon10Studio` routes internally,
 * so this single route mounts the entire Studio. Apps get it for free via the
 * `kon10Start()` Vite plugin, or can mount it explicitly with a one-line
 * re-export:
 *
 *   // src/routes/studio.$.tsx
 *   export { Route } from '@kon10/start/routes/studio'
 */
import { createFileRoute } from '@tanstack/react-router'
import { Kon10Studio } from '../studio.js'

// Built standalone (no app router typegen), so the literal path is cast.
export const Route = (createFileRoute as (path: string) => any)('/studio/$')({
  component: Kon10Studio,
})

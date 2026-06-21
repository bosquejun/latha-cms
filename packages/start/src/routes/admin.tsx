/**
 * Framework-owned `/admin/$` catch-all route. `LathaAdmin` routes internally,
 * so this single route mounts the entire admin. Apps get it for free via the
 * `lathaStart()` Vite plugin, or can mount it explicitly with a one-line
 * re-export:
 *
 *   // src/routes/admin.$.tsx
 *   export { Route } from '@latha/start/routes/admin'
 */
import { createFileRoute } from '@tanstack/react-router'
import { LathaAdmin } from '../admin.js'

// Built standalone (no app router typegen), so the literal path is cast.
export const Route = (createFileRoute as (path: string) => any)('/admin/$')({
  component: LathaAdmin,
})

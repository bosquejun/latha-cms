/**
 * Framework-owned `/setup` route. Apps get it for free via the `kon10Start()`
 * Vite plugin, or can mount it explicitly with a one-line re-export:
 *
 *   // src/routes/setup.tsx
 *   export { Route } from '@kon10/start/routes/setup'
 */
import { createFileRoute } from '@tanstack/react-router'
import { Kon10Setup } from '../setup.js'

// Built standalone (no app router typegen), so the literal path is cast.
export const Route = (createFileRoute as (path: string) => any)('/setup')({
  component: Kon10Setup,
})

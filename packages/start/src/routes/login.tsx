/**
 * Framework-owned `/login` route. Apps get it for free via the `kon10Start()`
 * Vite plugin, or can mount it explicitly with a one-line re-export:
 *
 *   // src/routes/login.tsx
 *   export { Route } from '@kon10/start/routes/login'
 */
import { createFileRoute } from '@tanstack/react-router'
import { Kon10Login } from '../login.js'

// Built standalone (no app router typegen), so the literal path is cast.
export const Route = (createFileRoute as (path: string) => any)('/login')({
  component: Kon10Login,
})

/**
 * `lathaStart()` — a thin wrapper around TanStack Start's Vite plugin that
 * injects LathaCMS's framework-owned routes (`/login` and the `/admin/$`
 * catch-all) through TanStack's virtual file routes. A consuming app keeps only
 * its own pages and `__root.tsx` under its routes directory — no boilerplate
 * route files for login or admin.
 *
 *   // vite.config.ts
 *   import { lathaStart } from '@latha/start/vite'
 *   export default defineConfig({ plugins: [..., lathaStart(), viteReact()] })
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { physical, rootRoute, route } from '@tanstack/virtual-file-routes'

type TanStackStartOptions = NonNullable<Parameters<typeof tanstackStart>[0]>
type TanStackStartPlugins = ReturnType<typeof tanstackStart>

// TanStack Start's default routes directory (`<srcDirectory>/routes`).
const ROUTES_DIR = './src/routes'

/**
 * Path to a framework route module, expressed relative to the app's routes
 * directory. Virtual file routes `join()` the file onto `routesDirectory`
 * rather than resolving absolute paths, so we hand back a relative path that
 * walks out of `src/routes` into the installed package (pnpm symlinks resolve
 * to the real file, which is what `import.meta.resolve` returns).
 */
function routeFile(subpath: string): string {
  const abs = fileURLToPath(import.meta.resolve(subpath))
  return path.relative(path.resolve(process.cwd(), ROUTES_DIR), abs)
}

export interface LathaStartOptions {
  /** Where the sign-in screen mounts. Default `/login`. */
  loginPath?: string
  /** Admin base path; the admin mounts as a catch-all under it. Default `/admin`. */
  adminBasePath?: string
  /** Extra options forwarded to `tanstackStart()`. */
  start?: TanStackStartOptions
}

export function lathaStart(
  options: LathaStartOptions = {},
): TanStackStartPlugins {
  const loginPath = options.loginPath ?? '/login'
  const adminBasePath = options.adminBasePath ?? '/admin'

  // Paths inside `virtualRouteConfig` are resolved relative to `routesDirectory`,
  // so the app's own pages are scanned in-place via `physical('', '.')` and the
  // two framework routes are layered on as siblings.
  const virtualRouteConfig = rootRoute('__root.tsx', [
    physical('', '.'),
    route(loginPath, routeFile('@latha/start/routes/login')),
    route(`${adminBasePath}/$`, routeFile('@latha/start/routes/admin')),
  ])

  const start = options.start ?? {}
  return tanstackStart({
    ...start,
    router: {
      ...start.router,
      virtualRouteConfig,
      importRoutesUsingAbsolutePaths: true,
    },
  })
}

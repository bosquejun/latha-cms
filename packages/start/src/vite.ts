/**
 * `lathaStart()` — a thin wrapper around TanStack Start's Vite plugin that
 * injects LathaCMS's framework-owned routes (`/login`, the `/admin/$` catch-all,
 * and the `/__latha/rpc` endpoint) through TanStack's virtual file routes, and
 * wires the app's `latha.config` into the framework's server route. A consuming
 * app keeps only its own pages and `__root.tsx` under its routes directory — no
 * boilerplate route files, and no hand-written RPC endpoint.
 *
 *   // vite.config.ts
 *   import { lathaStart } from '@latha/start/vite'
 *   export default defineConfig({ plugins: [..., lathaStart(), viteReact()] })
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { physical, rootRoute, route } from '@tanstack/virtual-file-routes'
import { DEFAULT_RPC_PATH } from './default-rpc.js'

type TanStackStartOptions = NonNullable<Parameters<typeof tanstackStart>[0]>
type TanStackStartPlugins = ReturnType<typeof tanstackStart>

/** Minimal structural shape of a Vite plugin — avoids a hard `vite` type dep. */
interface VitePluginLike {
  name: string
  enforce?: 'pre' | 'post'
  configResolved?: (config: { root: string }) => void
  resolveId?: (id: string) => string | undefined
  load?: (id: string) => string | undefined
}

const CONFIG_MODULE_ID = 'virtual:latha/config'
const RESOLVED_CONFIG_MODULE_ID = '\0' + CONFIG_MODULE_ID

/**
 * Resolves `virtual:latha/config` to a re-export of the app's `latha.config`
 * module, so the framework's server route can reach it without the app wiring
 * anything. Imported only from server-only code, so it never hits the client.
 */
function lathaConfigPlugin(configPath: string): VitePluginLike {
  let resolved = configPath
  return {
    name: 'latha:config',
    enforce: 'pre',
    configResolved(config) {
      resolved = path.isAbsolute(configPath)
        ? configPath
        : path.resolve(config.root, configPath)
    },
    resolveId(id) {
      if (id === CONFIG_MODULE_ID) return RESOLVED_CONFIG_MODULE_ID
      return undefined
    },
    load(id) {
      if (id === RESOLVED_CONFIG_MODULE_ID) {
        return `export { default } from ${JSON.stringify(resolved)}`
      }
      return undefined
    },
  }
}

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
  /**
   * Admin extension auto-discovery. When enabled (the default), files under the
   * convention directory are collected into the `virtual:latha/admin-extensions`
   * module. Pass `false` to disable, or an object to point at a custom folder.
   */
  admin?: false | { dir?: string }
  /**
   * Path to the app's `latha.config` module, relative to the project root.
   * Default `./latha.config.ts`.
   */
  configPath?: string
  /** Extra options forwarded to `tanstackStart()`. */
  start?: TanStackStartOptions
}

export function lathaStart(
  options: LathaStartOptions = {},
): TanStackStartPlugins {
  const loginPath = options.loginPath ?? '/login'
  const adminBasePath = options.adminBasePath ?? '/admin'
  const configPath = options.configPath ?? './latha.config.ts'

  // Paths inside `virtualRouteConfig` are resolved relative to `routesDirectory`,
  // so the app's own pages are scanned in-place via `physical('', '.')` and the
  // framework routes are layered on as siblings.
  const virtualRouteConfig = rootRoute('__root.tsx', [
    physical('', '.'),
    route(loginPath, routeFile('@latha/start/routes/login')),
    route(`${adminBasePath}/$`, routeFile('@latha/start/routes/admin')),
    route(DEFAULT_RPC_PATH, routeFile('@latha/start/routes/rpc')),
  ])

  const start = options.start ?? {}
  const plugins = tanstackStart({
    ...start,
    router: {
      ...start.router,
      virtualRouteConfig,
      importRoutesUsingAbsolutePaths: true,
    },
  })

  // Framework virtual-module plugins, appended to TanStack's array (Vite
  // flattens nested plugin arrays, keeping the single `plugins: [lathaStart()]`
  // ergonomics): the config bridge plus, unless disabled, admin auto-discovery.
  const extra: VitePluginLike[] = [lathaConfigPlugin(configPath)]
  if (options.admin !== false) {
    extra.push(adminExtensionsPlugin(options.admin?.dir ?? 'src/admin'))
  }

  return [
    ...(plugins as unknown[]),
    ...extra,
  ] as unknown as TanStackStartPlugins
}

const VIRTUAL_ID = 'virtual:latha/admin-extensions'
const RESOLVED_ID = '\0' + VIRTUAL_ID

/**
 * Resolves `virtual:latha/admin-extensions` to a module that collects the
 * convention folder via Vite's `import.meta.glob` (so HMR works for free) and
 * assembles a single `AdminExtensions` object from each file's default export
 * and `config`.
 */
function adminExtensionsPlugin(dir: string): VitePluginLike {
  const base = '/' + dir.replace(/^\.?\/*/, '').replace(/\/*$/, '')
  return {
    name: 'latha:admin-extensions',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    load(id) {
      return id === RESOLVED_ID ? buildModuleSource(base) : undefined
    },
  }
}

function buildModuleSource(base: string): string {
  const glob = (kind: string) =>
    `import.meta.glob('${base}/${kind}/**/*.{tsx,jsx,ts,js}', { eager: true })`
  return `
const widgetMods = ${glob('widgets')}
const pageMods = ${glob('pages')}
const dashboardMods = ${glob('dashboard')}
const settingsMods = ${glob('settings')}
const fieldMods = ${glob('fields')}

const list = (mods) => Object.keys(mods).sort().map((id) => ({ id, mod: mods[id] }))

export const adminExtensions = {
  widgets: list(widgetMods)
    .filter(({ mod }) => mod.default && mod.config && mod.config.zone)
    .map(({ id, mod }) => ({ id, Component: mod.default, zone: mod.config.zone, order: mod.config.order })),
  pages: list(pageMods)
    .filter(({ mod }) => mod.default && mod.config && mod.config.path)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...mod.config })),
  dashboardWidgets: list(dashboardMods)
    .filter(({ mod }) => mod.default)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...(mod.config || {}) })),
  settings: list(settingsMods)
    .filter(({ mod }) => mod.default && mod.config && mod.config.path)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...mod.config })),
  fields: list(fieldMods)
    .filter(({ mod }) => mod.default && mod.config && mod.config.type)
    .map(({ mod }) => ({ type: mod.config.type, renderer: mod.default })),
}
`
}

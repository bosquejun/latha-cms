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
import fs from 'node:fs'
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
  config?: (
    config: unknown,
    env: { command: 'build' | 'serve' },
  ) => Record<string, unknown> | undefined
  configResolved?: (config: { root: string }) => void
  resolveId?: (
    id: string,
    importer?: string,
  ) => string | undefined
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
  let abs = fileURLToPath(import.meta.resolve(subpath))
  // `import.meta.resolve` runs without the `development` export condition (this
  // plugin is loaded from `dist/`), so it always returns the built `dist/` path.
  // In dev we serve `@latha/*` from source via Vite's `development` condition;
  // if the injected route stayed on `dist/`, it would import a *second* copy of
  // `context.tsx`, so its `useLatha()` would miss the app's <LathaProvider>.
  // Redirect to the matching source file so the whole graph shares one module.
  if (process.env.NODE_ENV !== 'production') {
    abs = toSourcePath(abs)
  }
  return path.relative(path.resolve(process.cwd(), ROUTES_DIR), abs)
}

/** Map a built `…/dist/routes/admin.js` path to its `…/src/routes/admin.tsx`. */
function toSourcePath(distAbs: string): string {
  const marker = `${path.sep}dist${path.sep}`
  const idx = distAbs.lastIndexOf(marker)
  if (idx === -1) return distAbs
  const base = distAbs
    .slice(0, idx)
    .concat(path.sep, 'src', path.sep, distAbs.slice(idx + marker.length))
    .replace(/\.js$/, '')
  for (const ext of ['.tsx', '.ts']) {
    if (fs.existsSync(base + ext)) return base + ext
  }
  return distAbs
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
  const extra: VitePluginLike[] = [
    lathaDevSourcePlugin(),
    lathaConfigPlugin(configPath),
  ]
  if (options.admin !== false) {
    extra.push(adminExtensionsPlugin(options.admin?.dir ?? 'src/admin'))
  }

  return [
    ...(plugins as unknown[]),
    ...extra,
  ] as unknown as TanStackStartPlugins
}

/**
 * Resolves `@latha/start`'s own source directory if (and only if) this package
 * is consumed as linked workspace source — i.e. its `src/index.ts` exists on
 * disk next to the `dist/` we're running from. Published consumers install
 * `files: ["dist"]`, so `src/` is absent and this returns `undefined`, which is
 * how we tell "monorepo dev" apart from "installed from npm".
 */
function linkedSrcDir(): string | undefined {
  try {
    const distIndex = fileURLToPath(import.meta.resolve('@latha/start'))
    const pkgRoot = distIndex.slice(0, distIndex.lastIndexOf(`${path.sep}dist${path.sep}`))
    const srcDir = path.join(pkgRoot, 'src')
    return fs.existsSync(path.join(srcDir, 'index.ts')) ? srcDir : undefined
  } catch {
    return undefined
  }
}

/** Absolute `src/` dir of `@latha/ui` when linked as source, else `undefined`. */
function lathaUiSrcDir(): string | undefined {
  try {
    const distIndex = fileURLToPath(import.meta.resolve('@latha/ui'))
    const pkgRoot = distIndex.slice(0, distIndex.lastIndexOf(`${path.sep}dist${path.sep}`))
    const srcDir = path.join(pkgRoot, 'src')
    return fs.existsSync(path.join(srcDir, 'index.ts')) ? srcDir : undefined
  } catch {
    return undefined
  }
}

/**
 * Dev-only: when `@latha/*` packages are linked as workspace source (monorepo
 * development), make Vite load them from source for instant HMR — without each
 * app duplicating this in its own `vite.config`. A no-op for published
 * consumers (no linked `src/`), so it never affects apps installed from npm.
 *
 * Wires three things, all dev-gated:
 *  - the `development` export condition, so `@latha/*` resolve to their `src/`;
 *  - `ssr.noExternal` for `@latha/*`, so Vite transpiles the raw TS/TSX on SSR;
 *  - a scoped `@/` resolver for `@latha/ui` source (it uses a package-local
 *    `@/*` alias), confined to importers inside ui's own `src/` so it can never
 *    shadow the consuming app's own `@/`.
 */
function lathaDevSourcePlugin(): VitePluginLike {
  const uiSrc = lathaUiSrcDir()
  return {
    name: 'latha:dev-source',
    enforce: 'pre',
    config(_config, { command }) {
      if (command !== 'serve' || !linkedSrcDir()) return undefined
      return {
        resolve: { conditions: ['development'] },
        ssr: {
          resolve: { conditions: ['development'] },
          noExternal: [/^@latha\//],
        },
      }
    },
    resolveId(id, importer) {
      // Rewrite `@/…` only for imports originating inside @latha/ui's source.
      if (
        uiSrc &&
        id.startsWith('@/') &&
        importer &&
        importer.startsWith(uiSrc + path.sep)
      ) {
        const base = path.join(uiSrc, id.slice(2))
        // The alias carries no extension; resolve to the real file on disk
        // (matching tsconfig's `@/*` -> `src/*` with bundler resolution).
        for (const cand of [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          path.join(base, 'index.ts'),
          path.join(base, 'index.tsx'),
        ]) {
          if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
        }
      }
      return undefined
    },
  }
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

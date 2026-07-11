/**
 * `kon10Start()` — a thin wrapper around TanStack Start's Vite plugin that
 * injects Kon10's framework-owned routes (`/login`, the `/studio/$` catch-all,
 * and the `/__kon10/rpc` endpoint) through TanStack's virtual file routes, and
 * wires the app's `kon10.config` into the framework's server route. A consuming
 * app keeps only its own pages and `__root.tsx` under its routes directory — no
 * boilerplate route files, and no hand-written RPC endpoint.
 *
 *   // vite.config.ts
 *   import { kon10Start } from '@kon10/start/vite'
 *   export default defineConfig({ plugins: [..., kon10Start(), viteReact()] })
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { physical, rootRoute, route } from '@tanstack/virtual-file-routes'
import { DEFAULT_API_PATH, DEFAULT_RPC_PATH } from '@kon10/studio-sdk'
import { DEFAULT_MODULE_ROUTES_PATH } from './module-routes.js'

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
  configureServer?: (server: { ssrLoadModule: (id: string) => Promise<unknown> }) => void
  resolveId?: (id: string, importer?: string) => string | undefined
  load?: (id: string) => string | undefined | Promise<string | undefined>
}

const CONFIG_MODULE_ID = 'virtual:kon10/config'
const RESOLVED_CONFIG_MODULE_ID = '\0' + CONFIG_MODULE_ID

/**
 * Resolves `virtual:kon10/config` to a re-export of the app's `kon10.config`
 * module, so the framework's server route can reach it without the app wiring
 * anything. Imported only from server-only code, so it never hits the client.
 */
function kon10ConfigPlugin(configPath: string): VitePluginLike {
  let resolved = configPath
  return {
    name: 'kon10:config',
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
  // In dev we serve `@kon10/*` from source via Vite's `development` condition;
  // if the injected route stayed on `dist/`, it would import a *second* copy of
  // `context.tsx`, so its `useKon10()` would miss the app's <Kon10Provider>.
  // Redirect to the matching source file so the whole graph shares one module.
  if (process.env.NODE_ENV !== 'production') {
    abs = toSourcePath(abs)
  }
  return path.relative(path.resolve(process.cwd(), ROUTES_DIR), abs)
}

/** Map a built `…/dist/routes/studio.js` path to its `…/src/routes/studio.tsx`. */
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

export interface Kon10StartOptions {
  /** Where the sign-in screen mounts. Default `/login`. */
  loginPath?: string
  /** Studio base path; the Studio mounts as a catch-all under it. Default `/studio`. */
  studioBasePath?: string
  /**
   * Studio extension auto-discovery. When enabled (the default), files under the
   * convention directory are collected into the `virtual:kon10/studio-extensions`
   * module. Pass `false` to disable, or an object to point at a custom folder.
   */
  studio?: false | { dir?: string }
  /**
   * Path to the app's `kon10.config` module, relative to the project root.
   * Default `./kon10.config.ts`.
   */
  configPath?: string
  /**
   * The public content delivery API (`GET /api/v1/:slug[/:id]`). Mounted at
   * `DEFAULT_API_PATH` by default; pass `false` to not mount it at all.
   */
  api?: false
  /** Extra options forwarded to `tanstackStart()`. */
  start?: TanStackStartOptions
}

export function kon10Start(
  options: Kon10StartOptions = {},
): TanStackStartPlugins {
  const loginPath = options.loginPath ?? '/login'
  const studioBasePath = options.studioBasePath ?? '/studio'
  const configPath = options.configPath ?? './kon10.config.ts'

  // Paths inside `virtualRouteConfig` are resolved relative to `routesDirectory`,
  // so the app's own pages are scanned in-place via `physical('', '.')` and the
  // framework routes are layered on as siblings.
  const virtualRouteConfig = rootRoute('__root.tsx', [
    physical('', '.'),
    route(loginPath, routeFile('@kon10/start/routes/login')),
    route(`${studioBasePath}/$`, routeFile('@kon10/start/routes/studio')),
    route(DEFAULT_RPC_PATH, routeFile('@kon10/start/routes/rpc')),
    route(`${DEFAULT_MODULE_ROUTES_PATH}/$`, routeFile('@kon10/start/routes/modules')),
    ...(options.api === false
      ? []
      : [route(`${DEFAULT_API_PATH}/$`, routeFile('@kon10/start/routes/api'))]),
  ])

  const start = options.start ?? {}
  const plugins = tanstackStart({
    ...start,
    router: {
      ...start.router,
      virtualRouteConfig,
      // Relative imports avoid Windows path-encoding corruption when the app
      // lives under a directory containing non-ASCII characters.
      importRoutesUsingAbsolutePaths: false,
    },
  })

  // Framework virtual-module plugins, appended to TanStack's array (Vite
  // flattens nested plugin arrays, keeping the single `plugins: [kon10Start()]`
  // ergonomics): the config bridge plus, unless disabled, Studio auto-discovery.
  const extra: VitePluginLike[] = [
    kon10DevSourcePlugin(),
    kon10ConfigPlugin(configPath),
  ]
  if (options.studio !== false) {
    extra.push(studioExtensionsPlugin(options.studio?.dir ?? 'src/studio', configPath))
  }

  return [
    ...(plugins as unknown[]),
    ...extra,
  ] as unknown as TanStackStartPlugins
}

/**
 * Resolves `@kon10/start`'s own source directory if (and only if) this package
 * is consumed as linked workspace source — i.e. its `src/index.ts` exists on
 * disk next to the `dist/` we're running from. Published consumers install
 * `files: ["dist"]`, so `src/` is absent and this returns `undefined`, which is
 * how we tell "monorepo dev" apart from "installed from npm".
 */
function linkedSrcDir(): string | undefined {
  try {
    const distIndex = fileURLToPath(import.meta.resolve('@kon10/start'))
    const pkgRoot = distIndex.slice(0, distIndex.lastIndexOf(`${path.sep}dist${path.sep}`))
    const srcDir = path.join(pkgRoot, 'src')
    return fs.existsSync(path.join(srcDir, 'index.ts')) ? srcDir : undefined
  } catch {
    return undefined
  }
}

/** Absolute `src/` dir of `@kon10/ui` when linked as source, else `undefined`. */
function kon10UiSrcDir(): string | undefined {
  try {
    const distIndex = fileURLToPath(import.meta.resolve('@kon10/ui'))
    const pkgRoot = distIndex.slice(0, distIndex.lastIndexOf(`${path.sep}dist${path.sep}`))
    const srcDir = path.join(pkgRoot, 'src')
    return fs.existsSync(path.join(srcDir, 'index.ts')) ? srcDir : undefined
  } catch {
    return undefined
  }
}

/**
 * Dev-only: when `@kon10/*` packages are linked as workspace source (monorepo
 * development), make Vite load them from source for instant HMR — without each
 * app duplicating this in its own `vite.config`. A no-op for published
 * consumers (no linked `src/`), so it never affects apps installed from npm.
 *
 * Wires three things, all dev-gated:
 *  - the `development` export condition, so `@kon10/*` resolve to their `src/`;
 *  - `ssr.noExternal` for `@kon10/*`, so Vite transpiles the raw TS/TSX on SSR;
 *  - a scoped `@/` resolver for `@kon10/ui` source (it uses a package-local
 *    `@/*` alias), confined to importers inside ui's own `src/` so it can never
 *    shadow the consuming app's own `@/`.
 */
function kon10DevSourcePlugin(): VitePluginLike {
  const uiSrc = kon10UiSrcDir()
  return {
    name: 'kon10:dev-source',
    enforce: 'pre',
    config(_config, { command }) {
      if (command !== 'serve' || !linkedSrcDir()) return undefined
      return {
        resolve: { conditions: ['development'] },
        ssr: {
          resolve: { conditions: ['development'] },
          noExternal: [/^@kon10\//],
        },
      }
    },
    resolveId(id, importer) {
      // Rewrite `@/…` only for imports originating inside @kon10/ui's source.
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

const VIRTUAL_ID = 'virtual:kon10/studio-extensions'
const RESOLVED_ID = '\0' + VIRTUAL_ID

interface StudioUiCarrier { studio?: { ui?: string } }

/**
 * Load the app's `kon10.config` and read each module's and plugin's `studio.ui`
 * specifier. Reads static descriptor strings only — never bootstraps an
 * instance. `load` is Vite's SSR module loader (`server.ssrLoadModule`) at
 * serve time, or a direct `import()` wrapper at build time.
 */
export async function readModuleUiSpecifiers(
  load: (id: string) => Promise<unknown>,
  configPath: string,
): Promise<string[]> {
  const mod = (await load(configPath)) as {
    default?: { modules?: StudioUiCarrier[]; plugins?: StudioUiCarrier[] }
  }
  const seen = new Set<string>()
  for (const m of [...(mod.default?.modules ?? []), ...(mod.default?.plugins ?? [])]) {
    const ui = m.studio?.ui
    if (ui) seen.add(ui)
  }
  return [...seen]
}

/**
 * Build-time config load: there is no running dev server, so `virtual:kon10/config`
 * cannot be resolved by a raw Node `import()` (it's a Vite virtual id). Spin up a
 * throwaway, SSR-capable Vite server in middleware mode that knows ONLY about
 * `kon10ConfigPlugin` (so the virtual id resolves to the app's real `kon10.config`),
 * SSR-load the config through it, then close it.
 *
 * `configFile: false` is essential: it stops Vite from loading the app's real
 * `vite.config` (which calls `kon10Start()` again → infinite recursion). We register
 * only `kon10ConfigPlugin`, whose own `configResolved` resolves `configPath` against
 * this server's `root` — the same project root — so a relative `./kon10.config.ts`
 * still points at the real file.
 */
async function loadSpecifiersAtBuild(
  root: string,
  configPath: string,
): Promise<string[]> {
  // `vite` is not a declared dependency of this package (it arrives transitively
  // at the app level via TanStack Start). This code only ever runs at build time
  // inside that app context, where `vite` is installed — so resolve it from the
  // app's project root (NOT this `dist/` file's location, where it isn't in
  // scope) and import that absolute path. This keeps the package free of a hard
  // `vite` type/runtime dependency. A file URL is used so TypeScript does not try
  // to resolve `vite`'s types at compile time.
  const viteEntry = createRequire(path.join(root, 'noop.js')).resolve('vite')
  const { createServer } = (await import(
    /* @vite-ignore */ pathToFileURL(viteEntry).href
  )) as {
    createServer: (opts: unknown) => Promise<{
      ssrLoadModule: (id: string) => Promise<unknown>
      close: () => Promise<void>
    }>
  }
  const viteServer = await createServer({
    root,
    configFile: false, // do NOT recurse into the app's vite.config (kon10Start)
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    plugins: [kon10ConfigPlugin(configPath)],
    logLevel: 'silent',
  })
  try {
    return await readModuleUiSpecifiers(
      (id) => viteServer.ssrLoadModule(id),
      CONFIG_MODULE_ID,
    )
  } finally {
    await viteServer.close()
  }
}

/**
 * Resolves `virtual:kon10/studio-extensions` to a module that statically imports
 * each module's Studio UI barrel and merges it with the app's own `src/studio/`
 * glob via the shared helpers from `@kon10/studio-sdk`.
 */
function studioExtensionsPlugin(dir: string, configPath: string): VitePluginLike {
  const base = '/' + dir.replace(/^\.?\/*/, '').replace(/\/*$/, '')
  // Cached once; a change to the config's module list needs a dev-server restart.
  let specifiers: string[] | null = null
  let server: { ssrLoadModule: (id: string) => Promise<unknown> } | undefined
  let root = process.cwd()

  return {
    name: 'kon10:studio-extensions',
    // Capture the project root for the build-time throwaway server.
    configResolved(config: { root: string }) {
      root = config.root
    },
    // Vite calls configureServer with the dev server; cache it for SSR loads.
    configureServer(s: { ssrLoadModule: (id: string) => Promise<unknown> }) {
      server = s
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined
      if (specifiers === null) {
        if (server) {
          // Dev: tolerate transient config-load failures (HMR/partial edits).
          try {
            specifiers = await readModuleUiSpecifiers(
              (m) => server!.ssrLoadModule(m),
              CONFIG_MODULE_ID,
            )
          } catch (err) {
            console.warn(
              '[kon10] studio extensions: config not loadable yet; ' +
                'module Studio UI omitted for now —',
              err instanceof Error ? err.message : err,
            )
            specifiers = []
          }
        } else {
          // Build: a failure here would silently drop module Studio UI from the
          // production bundle. Fail loudly instead.
          try {
            specifiers = await loadSpecifiersAtBuild(root, configPath)
          } catch (err) {
            throw new Error(
              '[kon10] failed to discover module Studio UI at build time. ' +
                'The Studio config could not be loaded, so module-contributed UI ' +
                '(e.g. @kon10/auth/studio) would be missing from the build. ' +
                `Original error: ${err instanceof Error ? err.message : String(err)}`,
              { cause: err instanceof Error ? err : undefined },
            )
          }
        }
      }
      return buildModuleSource(base, specifiers)
    },
  }
}

export function buildModuleSource(base: string, specifiers: string[]): string {
  const glob = (kind: string) =>
    `import.meta.glob('${base}/${kind}/**/*.{tsx,jsx,ts,js}', { eager: true })`

  const moduleImports = specifiers
    .map((spec, i) => `import { studioExtensions as mod${i} } from ${JSON.stringify(spec)}`)
    .join('\n')
  const moduleList = specifiers.map((_, i) => `mod${i}`).join(', ')

  return `
import { collectStudioExtensions, mergeExtensions } from '@kon10/studio-sdk'
${moduleImports}

const appExtensions = collectStudioExtensions({
  widgets: ${glob('widgets')},
  pages: ${glob('pages')},
  dashboard: ${glob('dashboard')},
  settings: ${glob('settings')},
  fields: ${glob('fields')},
  lists: ${glob('lists')},
})

// Modules first, app last — the app overrides module UI on key conflict.
export const studioExtensions = mergeExtensions([${moduleList ? moduleList + ', ' : ''}appExtensions])
`
}

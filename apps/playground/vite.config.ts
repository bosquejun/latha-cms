import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { kon10Start } from '@kon10/start/vite'
import { sentrySourceMaps, resolveSentryRelease } from '@kon10/sentry/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

// One release identifier for everything — the git commit SHA by default (or
// SENTRY_RELEASE if set). Computed once here (Node context) and shared by the
// source-map upload and the client, so the runtime and the uploaded maps always
// agree without anyone hand-setting a release. See `resolveSentryRelease`.
const sentryRelease = resolveSentryRelease()

// Make the same release visible to the server-side plugin (it reads
// SENTRY_RELEASE) during dev and build, so server events match the client and
// the uploaded maps. A real deploy sets SENTRY_RELEASE itself; this only fills
// it in when unset, so it never overrides an explicit value.
if (sentryRelease && !process.env.SENTRY_RELEASE) {
  process.env.SENTRY_RELEASE = sentryRelease
}

export default defineConfig(({ command }) => ({
  // Emit source maps so `@kon10/sentry/vite` has maps to upload — de-minifying
  // the stack traces the browser SDK reports. No effect without Sentry creds.
  build: { sourcemap: true },
  // Inject the release into the client so `import.meta.env.VITE_SENTRY_RELEASE`
  // (read by `initSentryBrowser` in __root.tsx) resolves to the same value the
  // maps are uploaded under — no manual env needed.
  define: {
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(sentryRelease ?? ''),
  },
  // @libsql/client (local dev's Turso driver) dynamically requires a
  // platform-specific native binding (e.g. @libsql/linux-x64-gnu). Rollup
  // can't statically analyze that require, so it crashes if bundled at all
  // — not just when serverless-traced. Left un-bundled so Node resolves it
  // for real at runtime. No-op for the Vercel build: that build never
  // imports @libsql/client in the first place (see kon10.config.vercel.ts).
  ssr: {
    external: ['@libsql/client'],
  },
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    // kon10Start() wraps tanstackStart() and injects the framework's /login and
    // /studio/$ routes, so this app needs no route files for them. In the
    // monorepo it also serves @kon10/* packages from source for instant HMR;
    // that is a no-op for apps that install @kon10/start from npm.
    //
    // `configPath` picks the DB adapter's entrypoint: Vercel sets `VERCEL` in
    // both its build and runtime environments, so this resolves once, in
    // plain Node.js code here — never bundled — before either config module
    // is touched. That keeps @libsql/client (local dev) and `pg`
    // (Vercel) in entirely separate module graphs per build, rather than a
    // runtime branch inside one bundle that would pull both in.
    kon10Start({
      configPath: process.env.VERCEL ? './kon10.config.vercel.ts' : './kon10.config.ts',
    }),
    // Deploy-target plugin — build only. TanStack Start no longer bundles
    // its own deploy adapters; Nitro is what actually produces a deployable
    // `.output`/`.vercel/output` tree (auto-detecting the host from the
    // build environment). Restricted to `command === 'build'` because its
    // dev-mode environment setup collides with @kon10/start's Studio-UI
    // config loader (`ssrLoadModule` crashes with "invoke was called before
    // connect") — `vite dev` doesn't need Nitro at all, so this sidesteps
    // that rather than fighting it.
    command === 'build' &&
      nitro({
        rollupConfig: { external: ['@libsql/client'] },
      }),
    viteReact(),
    // Uploads the build's source maps to Sentry (a no-op without
    // SENTRY_AUTH_TOKEN, so local/dev builds are unaffected). Spread last so it
    // runs after the app bundle is produced. Same release as the client above.
    ...sentrySourceMaps({ release: sentryRelease }),
  ],
}))

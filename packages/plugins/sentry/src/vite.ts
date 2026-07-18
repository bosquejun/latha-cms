/**
 * Build-time source-map upload for the app (Studio/Start) bundle.
 *
 * `sentrySourceMaps()` wraps `@sentry/vite-plugin`: added to the app's
 * `vite.config.ts`, it uploads the build's source maps to Sentry (and injects
 * debug ids) so the minified stack traces Sentry receives — from the browser
 * (`@kon10/sentry/browser`) or SSR — map back to original TypeScript.
 *
 *   // vite.config.ts
 *   import { kon10Start } from '@kon10/start/vite'
 *   import { sentrySourceMaps } from '@kon10/sentry/vite'
 *   export default defineConfig({
 *     build: { sourcemap: true },
 *     plugins: [kon10Start(), viteReact(), ...sentrySourceMaps()],
 *   })
 *
 * `build.sourcemap: true` is required — without emitted maps there is nothing
 * to upload. The plugin is a **no-op unless an auth token is present**
 * (`authToken` option or `SENTRY_AUTH_TOKEN`), so local/dev builds without
 * Sentry credentials are unaffected and never fail. `release` should match the
 * `release` passed to `initSentryBrowser` / the backend plugin so uploaded maps
 * resolve the right event.
 */

import { execFileSync } from 'node:child_process'
import { sentryVitePlugin } from '@sentry/vite-plugin'

/**
 * Resolve a release identifier without anyone having to set `SENTRY_RELEASE` by
 * hand: an explicit value wins, then `SENTRY_RELEASE`, then the current git
 * commit SHA (what `@sentry/cli` itself proposes), then `undefined`.
 *
 * The point of a release is that the *runtime* value (`initSentryBrowser` /
 * the server plugin) and the *uploaded maps* value match exactly — deriving
 * both from one call to this makes that automatic. Call it once in
 * `vite.config.ts` (Node context, where git is reachable) and thread the result
 * to both `sentrySourceMaps({ release })` and the client (e.g. a `define` for
 * `import.meta.env.VITE_SENTRY_RELEASE`). Node-only — never call it from
 * browser code.
 */
export function resolveSentryRelease(explicit?: string): string | undefined {
  if (explicit) return explicit
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    return sha || undefined
  } catch {
    // Not a git checkout (or git unavailable) — leave it unset.
    return undefined
  }
}

export interface SentrySourceMapsOptions {
  /** Sentry org slug. Defaults to `SENTRY_ORG`. */
  org?: string
  /** Sentry project slug. Defaults to `SENTRY_PROJECT`. */
  project?: string
  /** Auth token with project write + release scope. Defaults to `SENTRY_AUTH_TOKEN`. */
  authToken?: string
  /**
   * Release name — match the runtime `release`. Defaults to `SENTRY_RELEASE`,
   * then the git commit SHA (see {@link resolveSentryRelease}).
   */
  release?: string
  /** Self-hosted Sentry URL. Defaults to `SENTRY_URL` (or Sentry SaaS). */
  url?: string
  /** Silence the plugin's own build logs. Defaults to `false`. */
  silent?: boolean
}

/**
 * Returns the `@sentry/vite-plugin` plugins configured for source-map upload,
 * or an empty array when no auth token is resolvable (so it is safe to spread
 * unconditionally into `plugins`). Spread the result: `...sentrySourceMaps()`.
 * The return type mirrors `sentryVitePlugin`'s own (Vite plugins) so the array
 * drops straight into a typed `plugins: [...]` without widening it.
 */
export function sentrySourceMaps(
  options: SentrySourceMapsOptions = {},
): ReturnType<typeof sentryVitePlugin> {
  const authToken = options.authToken ?? process.env.SENTRY_AUTH_TOKEN
  // Without a token there is nothing to authenticate the upload — skip entirely
  // rather than failing local/dev builds that have no Sentry credentials.
  if (!authToken) return []

  // Auto-derive from git when not given, so uploaded maps carry the same
  // release the runtime reports under without any env wiring.
  const release = resolveSentryRelease(options.release)
  return sentryVitePlugin({
    org: options.org ?? process.env.SENTRY_ORG,
    project: options.project ?? process.env.SENTRY_PROJECT,
    authToken,
    url: options.url ?? process.env.SENTRY_URL,
    silent: options.silent ?? false,
    ...(release ? { release: { name: release } } : {}),
  })
}

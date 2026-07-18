#!/usr/bin/env node
// Upload every published @kon10/* package's compiled source maps to Sentry.
//
// The base tsconfig already emits `.js.map` for each package's `dist/`, so the
// build produces the maps; this script ships them to Sentry (with debug-id
// injection) so a minified stack trace from a package that runs on the server
// resolves back to the original TypeScript. It complements `@kon10/sentry/vite`,
// which does the same for the app (Studio/browser) bundle — the two together
// cover both halves of a deployed Kon10 app.
//
// Gated entirely on Sentry credentials in the environment. With no auth token
// it is a friendly no-op (exit 0), so `pnpm sourcemaps:upload` is safe to wire
// into a release pipeline unconditionally and never fails a build that simply
// has no Sentry configured.
//
//   SENTRY_AUTH_TOKEN   required — token with project write + release scope
//   SENTRY_ORG          required — org slug
//   SENTRY_PROJECT      required — project slug
//   SENTRY_RELEASE      optional — release name; defaults to the git commit SHA
//                       (must match the runtime release, which defaults the same way)
//   SENTRY_URL          optional — self-hosted Sentry base URL
//
// Requires the `@sentry/cli` binary. pnpm skips its install script by default;
// run `pnpm approve-builds` (or set the token in CI where builds are approved)
// so the binary is present.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** SENTRY_RELEASE, or the git commit SHA — the same default `@kon10/sentry/vite` uses. */
function resolveRelease() {
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim() || undefined
  } catch {
    return undefined
  }
}

// Workspace globs from pnpm-workspace.yaml, expanded to their parent dirs.
const PACKAGE_PARENTS = [
  'packages',
  'packages/clients',
  'packages/modules',
  'packages/plugins',
]

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_URL } = process.env

if (!SENTRY_AUTH_TOKEN) {
  console.log('[kon10] sourcemaps: no SENTRY_AUTH_TOKEN set — skipping upload.')
  process.exit(0)
}
const missing = ['SENTRY_ORG', 'SENTRY_PROJECT'].filter((k) => !process.env[k])
if (missing.length > 0) {
  console.error(`[kon10] sourcemaps: missing required env: ${missing.join(', ')}`)
  process.exit(1)
}
const SENTRY_RELEASE = resolveRelease()
if (!SENTRY_RELEASE) {
  console.error(
    '[kon10] sourcemaps: no SENTRY_RELEASE set and not a git checkout — cannot derive a release.',
  )
  process.exit(1)
}

/** Every workspace package dir that ships a `dist/` (published, non-private). */
function distDirs() {
  const dirs = []
  for (const parent of PACKAGE_PARENTS) {
    const parentPath = join(repoRoot, parent)
    if (!existsSync(parentPath)) continue
    for (const name of readdirSync(parentPath)) {
      const pkgDir = join(parentPath, name)
      const pkgJsonPath = join(pkgDir, 'package.json')
      const distDir = join(pkgDir, 'dist')
      if (!existsSync(pkgJsonPath) || !existsSync(distDir) || !statSync(distDir).isDirectory()) {
        continue
      }
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
      if (pkg.private) continue
      dirs.push({ name: pkg.name, distDir })
    }
  }
  return dirs
}

const targets = distDirs()
if (targets.length === 0) {
  console.error('[kon10] sourcemaps: no built dist/ dirs found — run `pnpm build` first.')
  process.exit(1)
}

const { default: SentryCli } = await import('@sentry/cli')
const cli = new SentryCli(null, {
  authToken: SENTRY_AUTH_TOKEN,
  org: SENTRY_ORG,
  project: SENTRY_PROJECT,
  ...(SENTRY_URL ? { url: SENTRY_URL } : {}),
})

console.log(
  `[kon10] sourcemaps: uploading ${targets.length} package(s) for release ${SENTRY_RELEASE}`,
)

for (const { name, distDir } of targets) {
  console.log(`  • ${name}`)
  // Inject debug ids into the emitted JS + maps, then upload both. `sourcemaps
  // upload` also associates the files with the release.
  await cli.execute(['sourcemaps', 'inject', distDir], true)
  await cli.execute(
    ['sourcemaps', 'upload', '--release', SENTRY_RELEASE, distDir],
    true,
  )
}

console.log('[kon10] sourcemaps: done.')

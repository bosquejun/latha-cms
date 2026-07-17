/**
 * E2E entry point (`pnpm --filter @kon10/playground test:e2e`).
 *
 * Runs in two phases, because first-run setup and everything else need
 * mutually exclusive worlds:
 *
 *   1. setup    — a server booted with no ADMIN_EMAIL/ADMIN_PASSWORD, so the
 *                 install is empty and `/setup` is live. `setup.test.mjs` runs
 *                 against it and creates an admin as a side effect.
 *   2. the rest — a server booted with the admin seeded from those vars, on a
 *                 freshly reset db (so phase 1's admin is gone). Every other
 *                 spec shares this one instance and its single fresh seed.
 *
 * They can't share a server: phase 1 needs an install with no users, and every
 * other spec needs to sign in. They can't run concurrently either — both drive
 * the same `local.db`.
 */

import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startServer, stopServer, BASE_URL } from './server.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SETUP_SPEC = 'setup.test.mjs'

const allSpecs = readdirSync(here).filter((f) => f.endsWith('.test.mjs'))
const setupSpecs = allSpecs.filter((f) => f === SETUP_SPEC).map((f) => join(here, f))
const mainSpecs = allSpecs.filter((f) => f !== SETUP_SPEC).map((f) => join(here, f))

let server
let exitCode = 1

function shutdown() {
  stopServer(server)
  server = undefined
}
process.on('SIGINT', () => {
  shutdown()
  process.exit(130)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(143)
})

/** Run `specs` under Node's test runner against the running server. */
function runSpecs(specs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', ...specs], {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: BASE_URL },
    })
    child.on('exit', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

/** Boot a server, run `specs` against it, tear it down. */
async function phase(label, specs, options) {
  if (specs.length === 0) return 0
  console.log(`[e2e] (${label}) starting playground dev server…`)
  server = await startServer(options)
  console.log(`[e2e] (${label}) ready at ${BASE_URL}; running ${specs.length} spec(s)`)
  try {
    return await runSpecs(specs)
  } finally {
    shutdown()
  }
}

try {
  const setupCode = await phase('setup', setupSpecs, { seedAdmin: false })
  const mainCode = await phase('studio', mainSpecs, { seedAdmin: true })
  exitCode = setupCode || mainCode
} catch (err) {
  console.error('[e2e] run failed:', err instanceof Error ? err.message : err)
  exitCode = 1
} finally {
  shutdown()
}

process.exit(exitCode)

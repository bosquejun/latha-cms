/**
 * E2E entry point (`pnpm --filter @kon10/playground test:e2e`).
 *
 * Boots one playground dev server, runs every `*.test.mjs` in this directory
 * under Node's test runner against it, then tears the server down — so the
 * whole browser suite shares a single app instance and a single fresh seed.
 */

import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startServer, stopServer, BASE_URL } from './server.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const testFiles = readdirSync(here)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => join(here, f))

let server
let exitCode = 1

function shutdown() {
  stopServer(server)
}
process.on('SIGINT', () => {
  shutdown()
  process.exit(130)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(143)
})

try {
  console.log('[e2e] starting playground dev server…')
  server = await startServer()
  console.log(`[e2e] server ready at ${BASE_URL}; running ${testFiles.length} test file(s)`)

  exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', ...testFiles], {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: BASE_URL },
    })
    child.on('exit', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
} catch (err) {
  console.error('[e2e] run failed:', err instanceof Error ? err.message : err)
  exitCode = 1
} finally {
  shutdown()
}

process.exit(exitCode)

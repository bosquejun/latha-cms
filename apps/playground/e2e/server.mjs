/**
 * Playground dev-server lifecycle for the E2E suite.
 *
 * The production `.output` bundle externalizes `@libsql/client` and fails at
 * runtime (see the `verify` skill), so E2E — like manual verification — drives
 * the Vite dev server. We start it on an isolated port against a freshly reset
 * `local.db` so the run always begins from the seeded admin + starter data.
 *
 * The admin is seeded from ADMIN_EMAIL/ADMIN_PASSWORD, which we set explicitly
 * below: the playground only takes that fast path when both are present, and
 * otherwise leaves the install empty for the `/setup` flow. Setting them here
 * keeps these specs testing what they mean to test (the Studio) rather than
 * routing every run through first-run setup. `setup.test.mjs` covers that
 * flow on its own, against an install with the vars deliberately absent.
 */

import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { ADMIN } from './harness.mjs'

const playgroundRoot = dirname(dirname(fileURLToPath(import.meta.url)))

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100)
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`

/** Delete the libsql db files so boot re-seeds a clean admin + starter data. */
function resetDb() {
  for (const name of ['local.db', 'local.db-journal', 'local.db-wal', 'local.db-shm']) {
    rmSync(join(playgroundRoot, name), { force: true })
  }
}

/** Poll `${BASE_URL}/login` until it answers 200 (Vite compiles on first hit). */
async function waitForReady(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/login`)
      if (res.ok) return
    } catch {
      // server not up yet
    }
    await sleep(1000)
  }
  throw new Error(`playground dev server did not become ready at ${BASE_URL} within ${timeoutMs}ms`)
}

/**
 * Build the child env. `seedAdmin: false` *removes* ADMIN_EMAIL/ADMIN_PASSWORD
 * rather than merely not adding them — the developer's own shell or `.env` may
 * already define them, which would seed an admin and silently defeat a spec
 * that means to exercise first-run setup.
 */
function childEnv(seedAdmin) {
  const env = { ...process.env, E2E: '1' }
  if (seedAdmin) {
    env.ADMIN_EMAIL = ADMIN.email
    env.ADMIN_PASSWORD = ADMIN.password
  } else {
    delete env.ADMIN_EMAIL
    delete env.ADMIN_PASSWORD
  }
  return env
}

/**
 * Start the dev server (detached so we can kill the whole vite process tree),
 * prefixing its output. Resolves once `/login` responds.
 *
 * `seedAdmin` defaults to true: most specs want to be signed in, not to walk
 * first-run setup. Pass false to boot an empty install that lands on `/setup`.
 */
export async function startServer({ seedAdmin = true } = {}) {
  resetDb()
  const proc = spawn('pnpm', ['exec', 'vite', 'dev', '--port', String(E2E_PORT), '--strictPort'], {
    cwd: playgroundRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv(seedAdmin),
  })
  proc.stdout.on('data', (d) => process.stdout.write(`[dev] ${d}`))
  proc.stderr.on('data', (d) => process.stderr.write(`[dev] ${d}`))
  proc.on('exit', (code) => {
    if (code && code !== 0 && !stopping) {
      process.stderr.write(`[dev] server exited early with code ${code}\n`)
    }
  })
  await waitForReady()
  return proc
}

let stopping = false

/** Terminate the dev server's process group. */
export function stopServer(proc) {
  if (!proc || proc.exitCode !== null) return
  stopping = true
  try {
    process.kill(-proc.pid, 'SIGTERM')
  } catch {
    try {
      proc.kill('SIGTERM')
    } catch {
      // already gone
    }
  }
}

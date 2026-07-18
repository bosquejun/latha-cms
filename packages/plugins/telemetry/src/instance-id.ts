/**
 * Anonymous instance id — a random, non-identifying UUID persisted once to a
 * global config file (`$XDG_CONFIG_HOME/kon10/telemetry.json`, or
 * `~/.config/kon10/...`). It is the `distinct_id` for telemetry events, so runs
 * on the same machine group together without carrying anything identifying.
 *
 * All filesystem access is best-effort: if the file can't be read or written
 * (read-only FS, sandbox), we fall back to an ephemeral id so telemetry still
 * works — it just won't be stable across restarts, and the disclosure re-logs.
 */

import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

export interface TelemetryStore {
  /** Random anonymous id — the telemetry `distinct_id`. */
  anonymousId: string
  /** Whether the first-run disclosure has already been shown on this machine. */
  notified?: boolean
}

/** Read the project identity stamped by create-kon10-app. */
export function readProjectId(cwd = process.cwd()): string | undefined {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'),
    ) as { kon10?: { projectId?: unknown; telemetryId?: unknown } }
    // `telemetryId` was briefly emitted before the generic project field was
    // adopted. Keep it as a read-only fallback for already-generated apps.
    const id = manifest.kon10?.projectId ?? manifest.kon10?.telemetryId
    return typeof id === 'string' && id.length > 0 ? id : undefined
  } catch {
    return undefined
  }
}

function storeFile(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(base, 'kon10', 'telemetry.json')
}

function persist(file: string, store: TelemetryStore): boolean {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(store, null, 2))
    return true
  } catch {
    return false
  }
}

/**
 * Load (or create) the persisted anonymous id. `firstRun` is true when the
 * store didn't exist yet — the caller uses it to show the disclosure once.
 */
export function loadTelemetryStore(env: NodeJS.ProcessEnv = process.env): {
  store: TelemetryStore
  firstRun: boolean
} {
  const file = storeFile(env)
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<TelemetryStore>
    if (typeof parsed.anonymousId === 'string' && parsed.anonymousId) {
      return { store: { anonymousId: parsed.anonymousId, notified: parsed.notified }, firstRun: false }
    }
  } catch {
    // Not created yet (or unreadable) — fall through and create one.
  }
  const store: TelemetryStore = { anonymousId: crypto.randomUUID() }
  persist(file, store) // best-effort; ephemeral id if it fails
  return { store, firstRun: true }
}

/** Record that the first-run disclosure has been shown. Best-effort. */
export function markNotified(env: NodeJS.ProcessEnv = process.env): void {
  const file = storeFile(env)
  try {
    const store = JSON.parse(fs.readFileSync(file, 'utf8')) as TelemetryStore
    persist(file, { ...store, notified: true })
  } catch {
    // No store to update — the disclosure may re-log next boot. Acceptable.
  }
}

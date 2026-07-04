/**
 * Local-disk `StorageAdapter` — writes into the app's own `public/` directory
 * so Vite/TanStack Start serve the file back at `publicPath` with no extra
 * routing. Dev-only: there's no persistent disk on serverless deploys, so
 * production apps should configure an R2/S3-compatible adapter instead (a
 * later phase — not built here).
 */
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StorageAdapter } from '@latha/core'

export interface LocalDiskStorageOptions {
  /** Directory files are written to, e.g. `./public/uploads`. */
  dir: string
  /** URL prefix the stored files are served under. Default `/uploads`. */
  publicPath?: string
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function localDiskStorage(opts: LocalDiskStorageOptions): StorageAdapter {
  const { dir } = opts
  const publicPath = (opts.publicPath ?? '/uploads').replace(/\/+$/, '')

  return {
    async upload(file: File) {
      await mkdir(dir, { recursive: true })
      const key = `${randomUUID()}-${sanitize(file.name)}`
      const bytes = new Uint8Array(await file.arrayBuffer())
      await writeFile(path.join(dir, key), bytes)
      return { url: `${publicPath}/${key}`, key }
    },
    async delete(key: string) {
      await unlink(path.join(dir, key)).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== 'ENOENT') throw err
      })
    },
  }
}

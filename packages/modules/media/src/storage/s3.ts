/**
 * S3-compatible `StorageAdapter` — works against AWS S3, Cloudflare R2,
 * Supabase Storage, MinIO, DigitalOcean Spaces, or anything else speaking the
 * S3 REST API. Signs requests with SigV4 (see `./sigv4.ts`) and uploads via
 * `fetch`, so it has no native bindings and is safe to bundle for serverless
 * deploys (unlike `@libsql/client`, see `latha.config.vercel.ts` in the
 * playground app).
 *
 * Unlike `localDiskStorage`, this is the adapter production deploys should
 * use — serverless filesystems (Vercel included) don't persist writes.
 */
import { createHash, randomUUID } from 'node:crypto'
import type { StorageAdapter } from '@latha/core'
import { signS3Request } from './sigv4.js'

export interface S3StorageOptions {
  /** Bucket name. */
  bucket: string
  /**
   * SigV4 signing region. AWS S3: e.g. `'us-east-1'`. Cloudflare R2: `'auto'`.
   * Other S3-compatible providers: whatever they document (often `'auto'` or `'us-east-1'`).
   */
  region: string
  accessKeyId: string
  secretAccessKey: string
  /**
   * Custom S3-compatible endpoint host, e.g. `<account-id>.r2.cloudflarestorage.com`
   * for R2, or `<project>.supabase.co/storage/v1/s3` for Supabase Storage.
   * Omit for AWS S3 (`{bucket}.s3.{region}.amazonaws.com` is used instead).
   */
  endpoint?: string
  /**
   * Base URL uploaded files are publicly served from, e.g. a bucket's public
   * domain or a CDN in front of it. Defaults to the request URL used for the
   * upload itself, which only works if that host serves the object back
   * (true for a public AWS S3 bucket; R2 and most others need a custom
   * public domain configured, hence this option).
   */
  publicUrl?: string
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function s3Storage(opts: S3StorageOptions): StorageAdapter {
  const { bucket, region, accessKeyId, secretAccessKey } = opts
  const host = opts.endpoint ?? `${bucket}.s3.${region}.amazonaws.com`
  const objectPath = (key: string) => (opts.endpoint ? `/${bucket}/${key}` : `/${key}`)
  const requestUrl = (key: string) => `https://${host}${objectPath(key)}`
  const publicUrl = opts.publicUrl?.replace(/\/+$/, '')

  return {
    async upload(file: File) {
      const key = `${randomUUID()}-${sanitize(file.name)}`
      const bytes = new Uint8Array(await file.arrayBuffer())
      const payloadHash = createHash('sha256').update(bytes).digest('hex')

      const headers = signS3Request({
        method: 'PUT',
        host,
        path: objectPath(key),
        region,
        accessKeyId,
        secretAccessKey,
        payloadHash,
      })

      const res = await fetch(requestUrl(key), {
        method: 'PUT',
        headers: { ...headers, 'content-type': file.type || 'application/octet-stream' },
        body: bytes,
      })
      if (!res.ok) {
        throw new Error(`S3 upload failed: ${res.status} ${res.statusText} — ${await res.text()}`)
      }

      return { url: publicUrl ? `${publicUrl}/${key}` : requestUrl(key), key }
    },

    async delete(key: string) {
      const headers = signS3Request({
        method: 'DELETE',
        host,
        path: objectPath(key),
        region,
        accessKeyId,
        secretAccessKey,
      })

      const res = await fetch(requestUrl(key), { method: 'DELETE', headers })
      // S3 returns 204 whether or not the key existed; only surface real errors.
      if (!res.ok && res.status !== 404) {
        throw new Error(`S3 delete failed: ${res.status} ${res.statusText} — ${await res.text()}`)
      }
    },
  }
}

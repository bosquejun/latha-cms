/**
 * Minimal AWS Signature Version 4 signer for S3-compatible object storage
 * (AWS S3, Cloudflare R2, Supabase Storage, MinIO, DigitalOcean Spaces, ...).
 *
 * Hand-rolled instead of pulling in `@aws-sdk/client-s3`: the SigV4 algorithm
 * for a single PUT/DELETE request is a few dozen lines over `node:crypto`,
 * and it sidesteps the SDK's much larger dependency graph — the same
 * zero-extra-runtime-dependency approach already used for `postgres` in
 * `@latha/storage`.
 */
import { createHash, createHmac } from 'node:crypto'

const EMPTY_PAYLOAD_SHA256 = createHash('sha256').update('').digest('hex')

function encodeRfc3986(component: string): string {
  return encodeURIComponent(component).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

/** AWS's canonical-URI encoding: percent-encode each path segment, keep `/` literal. */
export function encodeS3Path(path: string): string {
  return path.split('/').map(encodeRfc3986).join('/')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac('AWS4' + secretAccessKey, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, 's3')
  return hmac(kService, 'aws4_request')
}

export interface SigV4Request {
  method: 'PUT' | 'DELETE'
  host: string
  path: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** Body's SHA-256 hex digest, or 'UNSIGNED-PAYLOAD' to skip hashing the body. */
  payloadHash?: string
  /** Fixed for deterministic tests; defaults to `new Date()`. */
  now?: Date
}

/** Returns the headers (`host`, `x-amz-date`, `x-amz-content-sha256`, `authorization`) to send with the request. */
export function signS3Request(req: SigV4Request): Record<string, string> {
  const now = req.now ?? new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = req.payloadHash ?? EMPTY_PAYLOAD_SHA256

  const canonicalUri = encodeS3Path(req.path)
  const canonicalHeaders =
    `host:${req.host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [
    req.method,
    canonicalUri,
    '', // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${req.region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const signature = hmac(signingKey(req.secretAccessKey, dateStamp, req.region), stringToSign).toString(
    'hex',
  )

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${req.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    host: req.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    authorization,
  }
}

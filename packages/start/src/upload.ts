/**
 * Server-only upload dispatcher for the media file route. Binary payloads
 * can't go through the JSON-only `/__latha/rpc` endpoint, so uploads get
 * their own route — but authentication and persistence reuse the exact same
 * pieces `dispatchLathaRpc` uses (`resolvePrincipal`, `operations.create`),
 * so RBAC enforcement, validation, and hooks are identical to any other
 * collection create. The only upload-specific step is turning bytes into a
 * URL via the configured `StorageAdapter` first.
 */
import {
  operations,
  AccessDeniedError,
  type JsonValue,
  type OperationContext,
  type ResolvedConfig,
} from '@latha/core'
import { hasPermission, ADMIN_ACCESS } from '@latha/auth'
import { getRuntime } from './runtime.js'
import { resolvePrincipal } from './server.js'

const MEDIA_SLUG = 'media'

/** Structural view of the policy `@latha/media` stamps on its entity. */
interface UploadPolicyCarrier {
  upload?: { maxFileSize: number; allowedMimeTypes: string[] }
}

/** `image/*` wildcards or exact matches, case-insensitive. */
function mimeMatches(allowed: string, actual: string): boolean {
  const a = allowed.toLowerCase()
  const b = actual.toLowerCase()
  if (a.endsWith('/*')) return b.startsWith(a.slice(0, -1))
  return a === b
}

function toJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export async function dispatchLathaUpload(
  config: ResolvedConfig,
  request: Request,
): Promise<JsonValue> {
  const latha = await getRuntime(config)
  const { principal } = await resolvePrincipal(latha)

  if (!hasPermission(principal, ADMIN_ACCESS)) {
    throw new AccessDeniedError('read', 'admin')
  }
  if (!latha.storage) {
    throw new Error('[latha] No storage adapter configured — add MediaModule({ storage: ... }) to your modules.')
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    throw new Error('Upload request must include a "file" field.')
  }
  const alt = form.get('alt')

  // Enforce the media module's upload policy (stamped on the media entity as
  // an opaque passthrough) before any bytes reach the storage adapter.
  const policy = (latha.getEntity(MEDIA_SLUG) as UploadPolicyCarrier | undefined)?.upload
  if (policy) {
    if (file.size > policy.maxFileSize) {
      throw new Error(
        `File is ${file.size} bytes; the upload limit is ${policy.maxFileSize} bytes.`,
      )
    }
    if (!policy.allowedMimeTypes.some((allowed) => mimeMatches(allowed, file.type))) {
      throw new Error(`File type "${file.type || 'unknown'}" is not allowed for upload.`)
    }
  }

  const { url, key } = await latha.storage.upload(file)

  const opCtx: OperationContext = { cms: latha, principal, context: { enforce: true } }
  const doc = await operations.create(opCtx, MEDIA_SLUG, {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    url,
    key,
    ...(typeof alt === 'string' && alt ? { alt } : {}),
  })

  return toJson(doc) as JsonValue
}

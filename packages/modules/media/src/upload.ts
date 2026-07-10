/**
 * The media module's upload endpoint. Binary payloads can't go through the
 * JSON-only Studio RPC, so this is a dedicated route the module declares on
 * itself (`MediaModule().routes`) — the runner (`@kon10/start`) discovers and
 * mounts it generically, with no media-specific knowledge of its own.
 *
 * `requireStudioAccess` on the route entry covers the "may this caller use the
 * Studio surface at all" gate; RBAC on the `media` collection itself (who may
 * `create`) is still enforced by `operations.create` below, same as any other
 * collection write.
 */
import { operations, type ModuleRoute, type ModuleRouteContext, type OperationContext } from '@kon10/core'
import { MEDIA_SLUG, type MediaEntity } from './entities.js'

function toJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** `image/*` wildcards or exact matches, case-insensitive. */
function mimeMatches(allowed: string, actual: string): boolean {
  const a = allowed.toLowerCase()
  const b = actual.toLowerCase()
  if (a.endsWith('/*')) return b.startsWith(a.slice(0, -1))
  return a === b
}

async function handleUpload({ cms, principal, request }: ModuleRouteContext): Promise<Response> {
  if (!cms.storage) {
    throw new Error(
      '[kon10] No storage adapter configured — add MediaModule({ storage: ... }) to your modules.',
    )
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    throw new Error('Upload request must include a "file" field.')
  }
  const alt = form.get('alt')

  // Enforce the module's upload policy (stamped on the media entity) before
  // any bytes reach the storage adapter.
  const policy = (cms.getEntity(MEDIA_SLUG) as MediaEntity | undefined)?.upload
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

  const { url, key } = await cms.storage.upload(file)

  const opCtx: OperationContext = { cms, principal, context: { enforce: true } }
  const doc = await operations.create(opCtx, MEDIA_SLUG, {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    url,
    key,
    ...(typeof alt === 'string' && alt ? { alt } : {}),
  })

  return Response.json(toJson(doc))
}

export const uploadRoute: ModuleRoute = {
  method: 'POST',
  requireStudioAccess: true,
  handler: handleUpload,
}

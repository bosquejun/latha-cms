/**
 * The delivery manifest (`GET /api/v1/_manifest`) as consumed by the CLI: a Zod
 * schema mirroring `@kon10/start`'s `EntityManifest` shape, plus loaders that
 * read it from a running Studio (over the delivery client) or from a saved JSON
 * file. Field configs are kept loose (`record`) — `typegen` walks them by
 * `type` rather than validating each field kind here.
 */
import { z } from 'zod'
import { createDeliveryClient, type JsonDoc } from '@kon10/client'

export const manifestFieldSchema = z.record(z.string(), z.unknown())

export const manifestEntitySchema = z.object({
  prefix: z.string(),
  slug: z.string(),
  cardinality: z.enum(['many', 'single']),
  kind: z.string().optional(),
  hierarchical: z.boolean().optional(),
  timestamps: z.boolean().default(true),
  fields: z.array(manifestFieldSchema),
})
export type ManifestEntity = z.infer<typeof manifestEntitySchema>

export const manifestSchema = z.object({
  entities: z.array(manifestEntitySchema),
})
export type Manifest = z.infer<typeof manifestSchema>

export interface FetchManifestOptions {
  /** Origin hosting the delivery API, e.g. `https://cms.example.com`. */
  url: string
  /** Optional `kon10_…` API key; anonymous fetches see only Public-readable entities. */
  apiKey?: string
  /** Delivery base path. Defaults to `/api/v1`. */
  basePath?: string
}

/** Fetch and validate the manifest from a running Studio. */
export async function fetchManifest(options: FetchManifestOptions): Promise<Manifest> {
  const client = createDeliveryClient({
    baseUrl: options.url,
    apiKey: options.apiKey,
    basePath: options.basePath,
  })
  const data = (await client.single('_manifest')) as JsonDoc | null
  if (!data) throw new Error(`No manifest returned from ${options.url}.`)
  return manifestSchema.parse(data)
}

/** Parse and validate a manifest from raw JSON text (a saved `_manifest` body). */
export function parseManifest(json: string): Manifest {
  const parsed: unknown = JSON.parse(json)
  // Accept either the bare manifest or a full delivery envelope `{ data, error }`.
  const candidate =
    parsed && typeof parsed === 'object' && 'data' in parsed
      ? (parsed as { data: unknown }).data
      : parsed
  return manifestSchema.parse(candidate)
}

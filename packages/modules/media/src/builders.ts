/**
 * The `media()` field builder. A dedicated field type (not
 * `relationship({ to: 'media' })`) so `@kon10/media/studio` can register its
 * own upload/picker renderer without teaching the generic relationship
 * renderer anything about media — same rationale as `taxonomy`.
 */
import type { FieldMeta, PhantomMeta } from '@kon10/core'

interface MediaOpts {
  required?: boolean
  meta?: FieldMeta
}

type IsPresent<O> = O extends { required: true } ? true : false

type MediaBuilt<O extends MediaOpts> = O & {
  type: 'media'
} & PhantomMeta<string, IsPresent<O>>

/** Reference to a `media` doc by id. Stores the media doc's id as a string. */
export function media<const O extends MediaOpts = {}>(opts?: O): MediaBuilt<O> {
  return { ...(opts ?? {}), type: 'media' } as MediaBuilt<O>
}

/**
 * `meta.hidden` projection — shared by every client-facing transport (the
 * public delivery API and the Studio RPC dispatcher) so credential material
 * (`passwordHash`, `keyHash`, ...) never reaches the browser, not just the
 * Studio form's rendering of it.
 */
import type { Entity } from '@kon10/core'

/** Fields whose `meta.hidden` flags credential material — never serialized to a client. */
export function hiddenFieldNames(entity: Entity): Set<string> {
  const hidden = new Set<string>()
  for (const field of entity.fields) {
    const meta = (field as { meta?: { hidden?: boolean } }).meta
    if (meta?.hidden) hidden.add((field as { name: string }).name)
  }
  return hidden
}

export function projectDoc(
  hidden: Set<string>,
  doc: Record<string, unknown>,
): Record<string, unknown> {
  if (hidden.size === 0) return doc
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (!hidden.has(key)) out[key] = value
  }
  return out
}

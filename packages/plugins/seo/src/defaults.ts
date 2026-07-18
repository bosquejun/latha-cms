/**
 * Zero-config derivation defaults.
 *
 * When an `seo` field omits its `from` map, `seoPlugin` infers one from the
 * entity's own fields so backend derivation works out of the box: the SEO
 * title follows the entity's title field, and the description follows the
 * first excerpt/summary-like field. Detection is by the entity's declared
 * `studio.useAsTitle` first, then a small candidate-name list — always
 * skipping the `seo` field itself and only pointing at text-like fields whose
 * value renders sensibly into a string.
 */

import type { AnyEntity } from 'kon10'

/** Field types whose stored value is a plain string safe to interpolate. */
const TEXT_LIKE = new Set(['text', 'richtext', 'slug', 'select'])

const TITLE_CANDIDATES = ['title', 'name', 'label', 'heading']
const DESCRIPTION_CANDIDATES = ['excerpt', 'description', 'summary', 'subtitle', 'tagline']

interface NamedField {
  name?: unknown
  type?: unknown
}

function textFieldNames(entity: AnyEntity): Set<string> {
  const names = new Set<string>()
  for (const field of entity.fields as NamedField[]) {
    if (typeof field.name === 'string' && TEXT_LIKE.has(String(field.type))) {
      names.add(field.name)
    }
  }
  return names
}

/** First candidate that names an existing text-like field on the entity. */
function pick(candidates: string[], available: Set<string>): string | undefined {
  return candidates.find((name) => available.has(name))
}

/**
 * Infer a `from` derivation map for an entity. Returns `{}` when nothing
 * sensible is found (a taxonomy with only a `name`, say, still yields a title
 * mapping; a truly field-less entity yields nothing and the hook is a no-op).
 */
export function inferFrom(entity: AnyEntity): Record<string, string> {
  const available = textFieldNames(entity)
  const from: Record<string, string> = {}

  const titleField =
    (typeof entity.studio?.useAsTitle === 'string' && available.has(entity.studio.useAsTitle)
      ? entity.studio.useAsTitle
      : undefined) ?? pick(TITLE_CANDIDATES, available)
  if (titleField) from.title = `{${titleField}}`

  const descriptionField = pick(DESCRIPTION_CANDIDATES, available)
  if (descriptionField) from.description = `{${descriptionField}}`

  return from
}

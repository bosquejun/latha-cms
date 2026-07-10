/**
 * Flatten a taxonomy term list into an ordered, depth-tagged list for a
 * single-select dropdown. Hierarchy is derived purely from each term's `parent`
 * pointer (the field `Taxonomy({ hierarchical: true })` adds) — a flat taxonomy
 * just yields depth-0 rows in input order. Terms whose `parent` doesn't resolve
 * to a known term are treated as roots so nothing is dropped.
 *
 * Lives at the package root (not under `src/studio`) so the server tsconfig — the
 * one with Node types — compiles it and its `node:test` suite; `tsconfig.studio.json`
 * also includes it so the taxonomy renderer can import it in the client bundle.
 */

export interface Term {
  id: string
  name?: string
  parent?: string | null
  [key: string]: unknown
}

export interface FlatTerm {
  id: string
  name: string
  depth: number
}

export function flattenTermTree(terms: Term[]): FlatTerm[] {
  const byParent = new Map<string | null, Term[]>()
  const ids = new Set(terms.map((t) => t.id))
  for (const term of terms) {
    const key = term.parent && ids.has(term.parent) ? term.parent : null
    const bucket = byParent.get(key)
    if (bucket) bucket.push(term)
    else byParent.set(key, [term])
  }

  const out: FlatTerm[] = []
  const visited = new Set<string>()
  const walk = (parent: string | null, depth: number) => {
    for (const term of byParent.get(parent) ?? []) {
      if (visited.has(term.id)) continue // guard against cyclic parents
      visited.add(term.id)
      out.push({ id: term.id, name: term.name ?? term.id, depth })
      walk(term.id, depth + 1)
    }
  }
  walk(null, 0)
  // Sweep any terms never reached from a root — e.g. a pure parent cycle where
  // no node is a root — so nothing silently disappears from the picker.
  for (const term of terms) {
    if (visited.has(term.id)) continue
    visited.add(term.id)
    out.push({ id: term.id, name: term.name ?? term.id, depth: 0 })
    walk(term.id, 1)
  }
  return out
}

/** Prefix a term label with em-dashes matching its nesting depth. */
export function indentLabel(term: FlatTerm): string {
  return term.depth > 0 ? `${'— '.repeat(term.depth)}${term.name}` : term.name
}

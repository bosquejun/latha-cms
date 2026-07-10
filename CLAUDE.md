# Kon10 — Developer Philosophy & Design Rules

This file is the authoritative guide for anyone (human or AI) contributing to this codebase. Read it before touching any package.

---

## The Two Non-Negotiables

### 1. Separation of Concerns Is Absolute

Every package has a strict boundary. Nothing crosses it. This is not a soft guideline — it is the load-bearing wall of the architecture.

| Package | What it owns | What it must never contain |
|---|---|---|
| `@kon10/core` | Kernel primitives: registry, hook engine, access evaluator, module lifecycle, field type registry contract | Module-specific logic, Studio/UI concerns, field types owned by modules |
| `@kon10/content` | `ContentModule`, `Collection`/`Document`/`Taxonomy` factories, taxonomy operations, content-specific field types (`taxonomy`) | Auth logic, user logic, media logic |
| `@kon10/auth` | Session handling, RBAC, guards | User entity logic, content entity logic |
| `@kon10/users` | The `users` collection, user operations | Auth session logic |
| `@kon10/media` | `MediaModule`, storage adapters, media-specific field type (`media`) | Content-specific logic |
| `@kon10/cache` | `CacheAdapter` implementations (`inMemoryCache`, `redisCache`) | Business logic — a cache adapter never knows what's being cached |
| `@kon10/studio-sdk` | Studio UI shell, field renderers, views, display hints | Business logic, persistence logic |
| `@kon10/ui` | Pure design system primitives | Any CMS knowledge whatsoever |
| `@kon10/start` | TanStack Start integration, RPC dispatcher | Business logic |
| `@kon10/storage` | `DBAdapter` implementation — `migrate()` issues `CREATE TABLE IF NOT EXISTS` only; no ALTER, schema drift is silent | Application logic |

**The test:** If you find yourself importing `@kon10/content` from `@kon10/core`, or `@kon10/auth` from `@kon10/content`, stop. The dependency direction is always inward toward core, never across modules.

### 2. Zod Is the Single Source of Truth

Zod schemas come first. TypeScript types are always derived from Zod via `z.infer<>`. Never write a TypeScript interface and then a matching Zod schema — that is duplication and it will diverge.

```ts
// WRONG — TS interface first, Zod schema mirrors it
interface TextField { type: 'text'; name: string; minLength?: number }
const textSchema = z.object({ type: z.literal('text'), name: z.string(), minLength: z.number().optional() })

// RIGHT — Zod schema first, type is inferred
const textFieldSchema = z.object({
  type: z.literal('text'),
  name: z.string(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
})
type TextField = z.infer<typeof textFieldSchema>
```

This applies everywhere: field configs, entity shapes, RPC inputs, API responses. If you are writing a TypeScript interface that mirrors something that could be validated, define the Zod schema first.

---

## The Kernel (`@kon10/core`)

The kernel is a pure, domain-agnostic orchestration layer. It:
- Manages the module lifecycle (topological resolution, `onInit`, `onReady`)
- Runs the hook engine (before/after lifecycle transformers)
- Evaluates access predicates
- Builds document validation schemas from registered field types
- Holds the field type registry contract

The kernel does **not** know about:
- Any specific field types (taxonomy, media, relationship-to-users — these are module concerns)
- Any Studio UI layout or display concepts
- Any specific entity kinds (Collection, Document, Taxonomy — these are `@kon10/content` concerns)
- Any concrete module (auth, users, content, media)

Core's only entity vocabulary is **structural**: every `Entity` has a `cardinality` (`'many'` — standard CRUD list — or `'single'` — one record, no list view) and an optional `hierarchical` flag (a self-referential parent field, for `'many'` entities that support nesting). That's the entirety of what the registry, operations layer, and storage migration need to handle every entity uniformly — they never branch on what a module *calls* the entity, only on its cardinality.

`Entity` also carries one opaque passthrough field, `kind?: string`, that the kernel never reads or branches on — the same contract as a field's `meta` bag. Modules stamp it for their own Studio/routing layer to read (e.g. `@kon10/content`'s `Collection()`/`Document()`/`Taxonomy()` factories stamp `'collection'`/`'document'`/`'taxonomy'`). `@kon10/content` owns `Collection`/`Document`/`Taxonomy` as public vocabulary — they are type aliases over `Entity<TDoc>` narrowed by `cardinality`, not separate interfaces in core. `@kon10/studio-sdk` and `@kon10/start` derive their own local `'collection' | 'document' | 'taxonomy'` display vocabulary from the opaque `kind` tag (falling back to a cardinality-derived guess when a module leaves it unset) — that vocabulary lives in those packages, never imported from core.

---

## Field Type System

### How it works

Field types are registered, not hardcoded. Core ships a registry and registers its own built-in types (`text`, `number`, `boolean`, `date`, `select`, `richtext`, `relationship`, `group`, `array`). Modules register their own types in `onInit`.

Each registration provides two things:
1. **`configSchema`** — a Zod schema that describes the field definition object (validated at config parse time)
2. **`buildDataSchema`** — a function from the field config to the Zod schema for the stored value (used by `buildDocumentSchema`)

```ts
// core — built-in type registration (inside core's own init)
registerFieldType({
  configSchema: z.object({
    type: z.literal('text'),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
  }),
  buildDataSchema: (config) => {
    let s = z.string()
    if (config.minLength != null) s = s.min(config.minLength)
    if (config.maxLength != null) s = s.max(config.maxLength)
    return s
  },
})

// @kon10/content — ContentModule.onInit registers 'taxonomy'
registerFieldType({
  configSchema: z.object({
    type: z.literal('taxonomy'),
    to: z.string(),
    many: z.boolean().optional(),
  }),
  buildDataSchema: (config) => config.many ? z.array(z.string()) : z.string(),
})

// @kon10/media — MediaModule.onInit registers 'media'
registerFieldType({
  configSchema: z.object({ type: z.literal('media') }),
  buildDataSchema: () => z.string(),
})
```

### What the `Field` type is

`Field` is the discriminated union of all registered `configSchema` inferred types. It is built from the registry at runtime — there is no hardcoded union in `types/field.ts`.

For TypeScript purposes (compile-time inference), core exports a base `Field` type covering its built-in types. Modules that add field types extend this via TypeScript module augmentation on `FieldTypeMap`:

```ts
// @kon10/content
declare module '@kon10/core' {
  interface FieldTypeMap {
    taxonomy: z.infer<typeof taxonomyFieldConfigSchema>
  }
}
```

### Field display metadata

Fields carry a `meta` bag (`FieldMeta`) for rendering hints. This lives in core because it is part of the field definition that users write in their config — it is not Studio-specific business logic. The kernel passes it through opaquely; only the Studio layer reads it.

```ts
interface FieldMeta {
  label?: string
  description?: string
  placeholder?: string
  hidden?: boolean
  sidebar?: boolean   // Studio form layout hint
}
```

---

## Extension Patterns

### Adding a field type
Register in your module's `onInit` via `cms.registerFieldType(...)`. Provide both `configSchema` and `buildDataSchema`. Augment `FieldTypeMap` in your module's `.d.ts` for TypeScript consumers.

### Adding access guards
Register in `onInit` via `cms.registerGuard(guard)`. Guards run after entity-level access predicates. Used by `@kon10/auth` for RBAC.

### Adding Studio UI
Follow the Studio extension convention (`src/studio/widgets/`, `src/studio/pages/`, etc.) or use `defineStudioExtensions` explicitly. No module should write directly to `@kon10/studio-sdk` internals.

### Adding entities
Return them in your module's `entities` array. The kernel registry discovers and de-duplicates them.

---

## Naming Rules

- `CollectionHooks`, `CollectionAccess`, `CollectionStudioConfig` → dead names. Use `EntityHooks`, `EntityAccess`, `EntityStudioConfig`.
- Hook args use `slug` (the entity slug), not `collection` — hooks run on documents and singletons too.
- No `Collection` prefix on generic concepts. `Collection` is a content-module entity kind, not a kernel concept.
- Field type discriminants are lowercase strings (`'text'`, `'taxonomy'`). Field config types are PascalCase (`TextField`, `TaxonomyField`).

---

## What "Generic" Means for Core

A concept belongs in core if it would be needed by a hypothetical CMS that has no content module, no auth module, and no Studio UI. The kernel is a lifecycle + validation + access orchestration layer. If a concept only makes sense in the presence of a specific module, it belongs in that module.

Ask: "Would a minimal CMS with only users and no content need this?" If yes → core. If no → the relevant module.

---

## Active Refactor: Zod-First Field Registry

**Status: Complete**

The field type system has been migrated from TypeScript-first (TS interfaces → Zod) to Zod-first (Zod schemas → inferred TS types). `types/field.ts` and the `schema/builder.ts` switch are gone; `packages/core/src/fields/` (`registry.ts`, `builtins.ts`, `meta.ts`, `types.ts`) is the only mechanism — all field types, including core's 9 built-ins, come from registered `configSchema`/`buildDataSchema` pairs, and `taxonomy()`/`media()` are registered by their owning modules' `onInit`.

Do not add new field types outside the registry (`registerFieldType`) — there is no `types/field.ts` or `schema/builder.ts` switch to fall back to.

---

## Commit Discipline

- Commits are scoped: `feat(content):`, `fix(core):`, `refactor(studio-sdk):`, etc.
- Do not mix cross-package concerns in one commit unless they are a single atomic change (e.g., an interface rename that must update all consumers simultaneously).
- After any refactor to core, run `pnpm -r typecheck` before committing.
- After any change to `@kon10/core` types, rebuild core (`pnpm --filter @kon10/core build`) before typechecking dependent packages.

## Naming Note: RBAC vs. Studio Branding

The seeded `admin` role, `SUPERADMIN`, and related RBAC terminology are generic access-control vocabulary — "the administrator role" — not tied to the Studio product name. Do not rename them when Studio-branded UI concepts change. `STUDIO_ACCESS` / `studio:access` is the permission that gates entry to the Studio UI and does track the product name; the seeded role name does not.

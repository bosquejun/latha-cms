# LathaCMS — Developer Philosophy & Design Rules

This file is the authoritative guide for anyone (human or AI) contributing to this codebase. Read it before touching any package.

---

## The Two Non-Negotiables

### 1. Separation of Concerns Is Absolute

Every package has a strict boundary. Nothing crosses it. This is not a soft guideline — it is the load-bearing wall of the architecture.

| Package | What it owns | What it must never contain |
|---|---|---|
| `@latha/core` | Kernel primitives: registry, hook engine, access evaluator, module lifecycle, field type registry contract | Module-specific logic, admin/UI concerns, field types owned by modules |
| `@latha/content` | `ContentModule`, `Collection`/`Document`/`Taxonomy` factories, taxonomy operations, content-specific field types (`taxonomy`) | Auth logic, user logic, media logic |
| `@latha/auth` | Session handling, RBAC, guards | User entity logic, content entity logic |
| `@latha/users` | The `users` collection, user operations | Auth session logic |
| `@latha/media` | `MediaModule`, storage adapters, media-specific field type (`media`) | Content-specific logic |
| `@latha/admin-sdk` | Admin UI shell, field renderers, views, display hints | Business logic, persistence logic |
| `@latha/ui` | Pure design system primitives | Any CMS knowledge whatsoever |
| `@latha/start` | TanStack Start integration, RPC dispatcher | Business logic |
| `@latha/storage` | `DBAdapter` implementation — `migrate()` issues `CREATE TABLE IF NOT EXISTS` only; no ALTER, schema drift is silent | Application logic |

**The test:** If you find yourself importing `@latha/content` from `@latha/core`, or `@latha/auth` from `@latha/content`, stop. The dependency direction is always inward toward core, never across modules.

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

## The Kernel (`@latha/core`)

The kernel is a pure, domain-agnostic orchestration layer. It:
- Manages the module lifecycle (topological resolution, `onInit`, `onReady`)
- Runs the hook engine (before/after lifecycle transformers)
- Evaluates access predicates
- Builds document validation schemas from registered field types
- Holds the field type registry contract

The kernel does **not** know about:
- Any specific field types (taxonomy, media, relationship-to-users — these are module concerns)
- Any admin UI layout or display concepts
- Any specific entity kinds (Collection, Document, Taxonomy — these are `@latha/content` concerns)
- Any concrete module (auth, users, content, media)

The three entity kinds (`Collection`, `Document`, `Taxonomy`) are defined in core because the kernel must handle them uniformly in the registry and operations layer. But the factories (`Collection()`, `Document()`, `Taxonomy()`) and all business logic around them live in `@latha/content`.

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

// @latha/content — ContentModule.onInit registers 'taxonomy'
registerFieldType({
  configSchema: z.object({
    type: z.literal('taxonomy'),
    to: z.string(),
    many: z.boolean().optional(),
  }),
  buildDataSchema: (config) => config.many ? z.array(z.string()) : z.string(),
})

// @latha/media — MediaModule.onInit registers 'media'
registerFieldType({
  configSchema: z.object({ type: z.literal('media') }),
  buildDataSchema: () => z.string(),
})
```

### What the `Field` type is

`Field` is the discriminated union of all registered `configSchema` inferred types. It is built from the registry at runtime — there is no hardcoded union in `types/field.ts`.

For TypeScript purposes (compile-time inference), core exports a base `Field` type covering its built-in types. Modules that add field types extend this via TypeScript module augmentation on `FieldTypeMap`:

```ts
// @latha/content
declare module '@latha/core' {
  interface FieldTypeMap {
    taxonomy: z.infer<typeof taxonomyFieldConfigSchema>
  }
}
```

### Field display metadata

Fields carry a `meta` bag (`FieldMeta`) for rendering hints. This lives in core because it is part of the field definition that users write in their config — it is not admin-specific business logic. The kernel passes it through opaquely; only the admin layer reads it.

```ts
interface FieldMeta {
  label?: string
  description?: string
  placeholder?: string
  hidden?: boolean
  sidebar?: boolean   // admin form layout hint
}
```

---

## Extension Patterns

### Adding a field type
Register in your module's `onInit` via `cms.registerFieldType(...)`. Provide both `configSchema` and `buildDataSchema`. Augment `FieldTypeMap` in your module's `.d.ts` for TypeScript consumers.

### Adding access guards
Register in `onInit` via `cms.registerGuard(guard)`. Guards run after entity-level access predicates. Used by `@latha/auth` for RBAC.

### Adding admin UI
Follow the admin extension convention (`src/admin/widgets/`, `src/admin/pages/`, etc.) or use `defineAdminExtensions` explicitly. No module should write directly to `@latha/admin-sdk` internals.

### Adding entities
Return them in your module's `entities` array. The kernel registry discovers and de-duplicates them.

---

## Naming Rules

- `CollectionHooks`, `CollectionAccess`, `CollectionAdminConfig` → dead names. Use `EntityHooks`, `EntityAccess`, `EntityAdminConfig`.
- Hook args use `slug` (the entity slug), not `collection` — hooks run on documents and singletons too.
- No `Collection` prefix on generic concepts. `Collection` is a content-module entity kind, not a kernel concept.
- Field type discriminants are lowercase strings (`'text'`, `'taxonomy'`). Field config types are PascalCase (`TextField`, `TaxonomyField`).

---

## What "Generic" Means for Core

A concept belongs in core if it would be needed by a hypothetical CMS that has no content module, no auth module, and no admin UI. The kernel is a lifecycle + validation + access orchestration layer. If a concept only makes sense in the presence of a specific module, it belongs in that module.

Ask: "Would a minimal CMS with only users and no content need this?" If yes → core. If no → the relevant module.

---

## Active Refactor: Zod-First Field Registry

**Status: Planned** (next major work item — security & architecture hardening from the June 2026 audit is complete)

The field type system is being migrated from TypeScript-first (TS interfaces → Zod) to Zod-first (Zod schemas → inferred TS types). See the plan in `docs/refactor-zod-first-fields.md`.

Key checkpoints:
- `types/field.ts` will be deleted. All field types come from Zod schemas.
- `schema/builder.ts` switch will be deleted. Document schema building uses the registry.
- `taxonomy()` and `media()` field builders move to their owning modules.
- Core registers only its 9 built-in field types at startup.

Do not add new field types to `types/field.ts` or new cases to `schema/builder.ts`. Use the registry once it lands.

---

## Commit Discipline

- Commits are scoped: `feat(content):`, `fix(core):`, `refactor(admin-sdk):`, etc.
- Do not mix cross-package concerns in one commit unless they are a single atomic change (e.g., an interface rename that must update all consumers simultaneously).
- After any refactor to core, run `pnpm -r typecheck` before committing.
- After any change to `@latha/core` types, rebuild core (`pnpm --filter @latha/core build`) before typechecking dependent packages.

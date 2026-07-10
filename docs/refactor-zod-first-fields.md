# Refactor: Zod-First Field Type Registry

## Problem

`packages/core/src/types/field.ts` defines TypeScript interfaces (`TextField`, `NumberField`, `TaxonomyField`, `MediaField`, …) and `packages/core/src/schema/builder.ts` contains a hardcoded switch that turns those interfaces into Zod schemas. This is wrong in two ways:

1. **Direction is inverted.** TypeScript interfaces are the source of truth; Zod schemas mirror them. The correct direction is Zod → `z.infer<>` → TypeScript types.
2. **Core knows about module-specific field types.** `TaxonomyField` belongs to `@kon10/content`. `MediaField` belongs to `@kon10/media`. Neither belongs in the kernel.

## Goal

- Zod schemas define every field type. TypeScript types are `z.infer<>` of those schemas.
- Core owns a **field type registry**. It registers its 9 generic built-in types at startup.
- Modules register their own field types in `onInit`. No module-specific field type ever lives in core.
- The hardcoded switch in `builder.ts` is replaced by a registry lookup.
- `types/field.ts` is deleted.

---

## Architecture

### The Registry Contract (in `@kon10/core`)

```ts
// packages/core/src/fields/registry.ts

export interface FieldTypeEntry<TConfig extends z.ZodObject<any> = z.ZodObject<any>> {
  /** Zod schema for the field definition object (validated at config parse time). */
  configSchema: TConfig
  /**
   * Build the Zod schema for the field's stored value.
   * Receives the parsed config. The registry injects itself so recursive
   * types (group, array) can call buildDocumentSchema.
   */
  buildDataSchema: (
    config: z.infer<TConfig>,
    registry: FieldRegistry,
  ) => z.ZodTypeAny
}

export class FieldRegistry {
  register<T extends z.ZodObject<any>>(entry: FieldTypeEntry<T>): void
  buildFieldUnion(): z.ZodDiscriminatedUnion<'type', ...>
  buildDocumentSchema(fields: Field[]): z.ZodObject<z.ZodRawShape>
}

// Singleton exported from core
export const fieldRegistry: FieldRegistry
// Convenience re-export
export const registerFieldType: FieldRegistry['register']
```

### `FieldTypeMap` for TypeScript (compile-time extensibility)

Core exports an interface that modules can augment:

```ts
// packages/core/src/fields/types.ts

// Base fields every field config has (before the type-specific shape)
export interface BaseFieldConfig {
  name: string
  required?: boolean
  unique?: boolean
  defaultValue?: unknown
  meta?: FieldMeta   // display hints — see below
}

// Core's built-in entries. Modules augment this.
export interface FieldTypeMap {
  text:         BaseFieldConfig & { type: 'text'; minLength?: number; maxLength?: number }
  number:       BaseFieldConfig & { type: 'number'; min?: number; max?: number; integer?: boolean }
  boolean:      BaseFieldConfig & { type: 'boolean' }
  date:         BaseFieldConfig & { type: 'date' }
  select:       BaseFieldConfig & { type: 'select'; options: string[]; many?: boolean }
  richtext:     BaseFieldConfig & { type: 'richtext' }
  relationship: BaseFieldConfig & { type: 'relationship'; to: string; many?: boolean }
  group:        BaseFieldConfig & { type: 'group'; fields: Field[] }
  array:        BaseFieldConfig & { type: 'array'; fields: Field[] }
}

// Derived from the map — the union every consumer works with
export type FieldType = keyof FieldTypeMap
export type Field = FieldTypeMap[FieldType]
```

Modules augment at their own boundary:

```ts
// packages/modules/content/src/fields.ts
import type { BaseFieldConfig } from '@kon10/core'

export interface TaxonomyFieldConfig extends BaseFieldConfig {
  type: 'taxonomy'
  to: string
  many?: boolean
}

declare module '@kon10/core' {
  interface FieldTypeMap {
    taxonomy: TaxonomyFieldConfig
  }
}
```

### `FieldMeta` — display hints

Renamed from `FieldAdminConfig`. Stays in core because it is part of the field definition that users write; the kernel passes it through opaquely.

```ts
// packages/core/src/fields/meta.ts
export interface FieldMeta {
  label?: string
  description?: string
  placeholder?: string
  hidden?: boolean
  sidebar?: boolean
}
```

---

## Migration Steps

### Step 1 — Create the registry (`packages/core/src/fields/`)

New files:
- `meta.ts` — `FieldMeta` (renamed from `FieldAdminConfig`)
- `types.ts` — `FieldTypeMap`, `BaseFieldConfig`, derived `Field` / `FieldType`
- `registry.ts` — `FieldRegistry` class, `fieldRegistry` singleton, `registerFieldType` export
- `builtins.ts` — registers core's 9 built-in field types against `fieldRegistry`

`builtins.ts` is called once at core init (from `bootstrap/index.ts`).

### Step 2 — Replace `schema/builder.ts`

`buildZodSchema(fields)` moves into `FieldRegistry.buildDocumentSchema(fields)`. The switch is deleted; each field type's `buildDataSchema` in the registry replaces its case.

`buildZodSchema` re-exported from core as a thin wrapper over `fieldRegistry.buildDocumentSchema` for backwards compatibility during transition.

### Step 3 — Replace `types/field.ts`

Delete `types/field.ts`. All field types come from `z.infer<>` of the Zod schemas used during registration, surfaced to TypeScript consumers via `FieldTypeMap` augmentation.

Update `types/index.ts` to re-export from `fields/types.ts` instead.

### Step 4 — Update `schema/fields.ts` (builders)

The phantom type system (`__out`, `__present`, `Built<>`, `InferDoc`) stays — it is the mechanism for inferring `TDoc` from a `FieldsRecord`. But:

- `AnyFieldDef.admin` → `AnyFieldDef.meta` (rename)
- `FieldAdminConfig` import → `FieldMeta`
- `media()` and `taxonomy()` builders are **deleted** from this file
- Builder option types derive from the Zod config schemas rather than the TS interfaces

### Step 5 — Move `taxonomy` field type to `@kon10/content`

```
packages/modules/content/src/fields/
  taxonomy.ts     — configSchema (Zod), TaxonomyFieldConfig, buildDataSchema
  index.ts        — registers via registerFieldType(), augments FieldTypeMap
```

`ContentModule.onInit` calls the registration. The `taxonomy()` builder moves here too.

### Step 6 — Move `media` field type to `@kon10/media`

Same pattern as taxonomy. `MediaModule.onInit` registers the field type.

### Step 7 — Update `Kon10Instance`

Add `registerFieldType` to `Kon10Instance` so modules can access it via `cms`:

```ts
interface Kon10Instance {
  // ...existing...
  registerFieldType(entry: FieldTypeEntry): void
}
```

### Step 8 — Update consumers

- `packages/studio-sdk/src/fields/registry.tsx` — renderer registry already keyed by `FieldType` string; no structural change, but `media` and `taxonomy` renderers must be registered by their modules' Studio extensions rather than hardcoded
- `packages/modules/storage/src/schema/generator.ts` — uses `Field` union; update imports
- `packages/start/src/studio.tsx` — uses `Field` type for form rendering; update imports
- All `FieldAdminConfig` references → `FieldMeta`, `field.admin` → `field.meta`

---

## File Deletion Checklist

| File | Action |
|---|---|
| `packages/core/src/types/field.ts` | Delete after Step 3 |
| `packages/core/src/schema/builder.ts` | Delete after Step 2 |
| `packages/core/src/schema/fields.ts` | Keep, but strip `media()`/`taxonomy()`, rename admin → meta |

---

## Acceptance Criteria

- `pnpm -r typecheck` passes with zero errors
- `types/field.ts` does not exist
- `schema/builder.ts` does not exist
- No `'media'` or `'taxonomy'` string literals in `packages/core/src/`
- `ContentModule.onInit` registers `taxonomy` field type
- `MediaModule.onInit` registers `media` field type
- Adding a new field type requires touching only the owning module, not core

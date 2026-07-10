# Plan: Zod Instances as Field Builder Inputs

**Status: Complete** — Phase 0 (Zod 4 upgrade), Phase 1 (`select` takes
`z.enum`), and Phase 2 (`schema` escape hatch + `jsonSchema` descriptors)
are all implemented. Tests live in
`packages/core/src/fields/escape-hatch.test.ts`.

## The Question

Should field builders accept Zod schema instances instead of literals — e.g.
`select({ options: z.enum(['draft', 'published']) })` instead of
`select({ options: ['draft', 'published'] })`? And if so, instances-only or
both forms?

## Recommendation

**Accept Zod instances at the authoring surface; keep serializable literals as
the canonical internal representation. The builder is the normalization
point.** For `select`, `options` becomes `z.enum(...)` only — no literal
array form.

One sentence version: *Zod in, JSON out.* Builders may take rich Zod input,
but the `Field` config that `stampFields` produces — the thing the registry
validates, the storage generator reads, and `describe()` ships to the Studio
client — stays pure JSON-serializable data.

## Why not Zod instances all the way down

It is tempting to store the `ZodEnum` in the field config and have
`buildDataSchema` just return it. Three hard constraints rule this out:

1. **The wire boundary.** `describe()` (`packages/start/src/server.ts`) sends
   `entity.fields` to the Studio client over RPC, and responses pass through
   `JSON.parse(JSON.stringify(...))`. A Zod instance does not survive this —
   and the select renderer genuinely needs `options: string[]` to draw a
   dropdown. Any design that puts Zod instances in the canonical config must
   invent a serialization for them; the literal config *is* that
   serialization, and we already have it.

2. **Config validation degrades.** `buildFieldConfigUnion()` validates raw
   field definitions with a discriminated union of plain-data schemas. A
   config carrying class instances can only be validated with
   `z.instanceof(z.ZodEnum)` — weaker, version-coupled (instanceof breaks
   across duplicated zod installs), and it pollutes the otherwise pure
   data-in/data-out registry contract.

3. **The registry already owns literal → Zod.** `buildDataSchema` exists
   precisely to turn a literal config into the value schema. Moving that
   responsibility into user configs would leave the registry with nothing to
   do for those fields on the server and no way to do it on the client.

## Why not literals-only (status quo)

- **Reuse / single source of truth.** The real win of `z.enum` is defining
  the enum once and using it everywhere:

  ```ts
  export const postStatus = z.enum(['draft', 'published'])
  export type PostStatus = z.infer<typeof postStatus>

  // kon10.config.ts
  status: select({ options: postStatus, defaultValue: 'draft' })

  // app code, RPC filters, anywhere
  postStatus.parse(searchParams.status)
  ```

  With literal arrays, apps that want the enum elsewhere must duplicate it —
  exactly the divergence the Zod-first rule exists to prevent.

- **Philosophical consistency.** CLAUDE.md: Zod schemas come first, types are
  derived. The field *config* schemas are already Zod-first internally; this
  extends the same principle to the user-facing authoring surface.

- **Better `defaultValue` typing for free.** Today `SelectOpts.defaultValue`
  is `string` — `defaultValue: 'drafts'` (typo) compiles. With the builder
  generic over the `ZodEnum`, `defaultValue` becomes `z.infer<typeof options>`
  and typos are compile errors.

Note that plain type inference is *not* a differentiator: the current
`const O extends SelectOpts` const-generic already infers
`'draft' | 'published'` from a literal array. The case for Zod is reuse,
consistency, and `defaultValue` narrowing — not inference.

## Why instances-only for `select` (no dual form)

Accepting both `readonly string[]` and `z.ZodEnum` is cheap at runtime
(`Array.isArray`), but:

- Two input forms means two branches in `SelectOut` inference, two
  documentation paths, and "which one is idiomatic?" forever.
- We are pre-1.0; the entire migration is a handful of call sites
  (playground config ×2, `built-in-blocks.ts` ×5, docs).
- The project's identity is "the Zod-native CMS". One way to do it.

Cost: every config now imports `z`. Soften by re-exporting `z` from
`@kon10/core` (and `@kon10/content`), so configs don't grow a separate `zod`
dependency line.

## Design

### Tier 1 — `select`: `options` is a `ZodEnum` (this refactor's core)

```ts
// schema/fields.ts — Zod 4: ZodEnum is generic over an entries record,
// not a string tuple, so constrain on the bare class and use z.infer.
type SelectOpts<T extends z.ZodEnum> = CommonOpts & {
  options: T
  many?: boolean
  defaultValue?: z.infer<T> | z.infer<T>[]
}

export function select<
  T extends z.ZodEnum,
  const O extends SelectOpts<T>,
>(opts: O & { options: T }): Built<SelectField, SelectOut<T, O>, IsPresent<O>> {
  return withMeta({
    ...opts,
    type: 'select',
    // Normalize: ZodEnum → literal string[] for the canonical config.
    options: [...opts.options.options],
  })
}

type SelectOut<T extends z.ZodEnum, O> = O extends { many: true }
  ? z.infer<T>[]
  : z.infer<T>
```

`ZodEnum.options` still exists in Zod 4 and returns the values array, so the
normalization line is version-stable.

Everything downstream is untouched: `selectFieldConfigSchema` keeps
`options: z.array(z.string())`, the registry's `buildDataSchema` keeps
rebuilding `z.enum` from the literal array, the Studio renderer keeps reading
`options: string[]`, the wire format doesn't change. The blast radius is one
builder plus call sites.

### Tier 2 — scalar refinements: optional `schema` escape hatch (follow-up)

For `text` / `number` / `date`, allow a full Zod schema in place of the
constraint bag:

```ts
email: text({ schema: z.email(), required: true })
price: number({ schema: z.number().positive().multipleOf(0.01) })
```

Mechanics:

- **JSON Schema mirror for the wire (`z.toJSONSchema`).** Instead of
  hand-introspecting bounds getter-by-getter, the server runs Zod 4's
  first-class `z.toJSONSchema(schema)` and ships the result on the field
  descriptor as `jsonSchema`. That captures everything JSON Schema can
  express — min/max, patterns, `format: 'email'`, `multipleOf` — with zero
  bespoke introspection code to maintain. The Studio client reads it for form
  hints and lightweight pre-validation. Constraints JSON Schema can't carry
  (custom `.refine`/`.transform` — Zod skips or errors on these depending on
  the `unrepresentable` option; use `'any'` to degrade gracefully) simply
  don't reach the client — consistent with the existing contract in
  `registry.ts`: *"real validation always runs on the server."*

- **Symbol-keyed live channel, server-only.** The builder stashes the
  original instance under a symbol key
  (`config[kDataSchema] = opts.schema`). Symbol keys survive the
  `{ name, ...def }` spread in `stampFields` but are invisible to
  `JSON.stringify`, so `describe()`/`toJson` drop them with zero code.
  `buildDocumentSchema` prefers `field[kDataSchema]` over
  `entry.buildDataSchema(field, this)` when present.

  Implementation caveat: if a code path replaces a config with the *parsed
  clone* from `configSchema.parse()`, the symbol is lost — the parse output
  must not substitute for the original object, or the symbol must be
  re-attached after parse. Add a test that a `schema`-carrying field still
  round-trips through registration and `buildDocumentSchema`.

- `schema` and the literal constraint options are mutually exclusive
  (compile-time via option types, runtime via a builder throw).

### Tier 3 — structural fields: stay literal (no change, on purpose)

`relationship`, `group`, `array`, `blocks`, and module types (`taxonomy`,
`media`) describe graph/storage/UI semantics — target entity slugs, nesting,
upload behavior — that a Zod value schema cannot express and that the storage
generator and Studio renderers consume structurally. `group`/`array` already
compose builders that resolve to Zod underneath. Forcing Zod syntax onto
these would be cosmetic, not semantic.

Module-owned builders adopt the same normalization idiom in their own
packages when it earns its keep (e.g. a future `taxonomy` with a constrained
term enum); core needs no change for that — the pattern lives in the builder,
not the registry.

## Migration Steps

### Phase 0 — upgrade the workspace to Zod 4 (prerequisite, own commit)

The workspace currently pins `zod ^3.24.1` everywhere except
`@kon10/content`, which already pins `^3.25.76` — a latent dual-instance
hazard (two zod copies break `instanceof` checks and schema identity).
Phase 0 unifies every package on one latest `zod ^4.x` pin: `@kon10/core`,
`@kon10/studio-sdk`, `@kon10/content`, `@kon10/media`, `apps/playground`.

Known v4 breakages in this codebase (from an audit of current usage):

| Site | v3 idiom | v4 replacement |
|---|---|---|
| `core/src/fields/registry.ts:25` | `typeLiteral._def.value` | public `.value` getter on `ZodLiteral` |
| `core/src/fields/registry.ts:75`, `content/src/module.ts:71` | `.merge(other)` | `.extend(other.shape)` (merge is removed) |
| `registry.ts:17,73`, `builtins.ts:97`, `content/src/module.ts:64` | `z.ZodTypeAny` | `z.ZodType` |
| `builtins.ts:54,59`, `studio-sdk/src/client/rpc.ts`, `content/src/module.ts:39` | `z.record(z.unknown())` | `z.record(z.string(), z.unknown())` (key schema required) |
| `registry.ts:76` | `ZodDiscriminatedUnionOption<'type'>` cast | type removed; v4's looser `discriminatedUnion` typing should drop the cast entirely |
| `media/src/module.test.ts:41` | `cover._def.typeName === 'ZodString'` | `cover instanceof z.ZodString` |

Also sweep for error-customization params (`required_error`, `errorMap`,
`message`) → unified `error` param, and deprecated string formats
(`z.string().email()` → `z.email()`).

Acceptance: single zod version in the lockfile;
`pnpm --filter @kon10/core build && pnpm -r typecheck` green; existing field
registry tests pass unchanged.

### Phase 1 — `select` takes `z.enum` (single commit, `refactor(core)` + call sites)

1. `packages/core/src/schema/fields.ts` — retype `SelectOpts`/`SelectOut`,
   make `select()` generic over the `ZodEnum`, normalize `.options` to the
   literal array. Type `defaultValue` as `z.infer<T>` (array when
   `many: true`).
2. Re-export `z` from `@kon10/core` (and via `@kon10/content`) so configs
   have one import surface.
3. Update call sites: `apps/playground/kon10.config.ts` (2),
   `packages/modules/content/src/built-in-blocks.ts` (5).
4. Update examples in `README.md`, `SPEC.md`, `docs/concepts/entities.md`,
   and the doc-comment in `schema/fields.ts`.
5. `pnpm --filter @kon10/core build && pnpm -r typecheck` (per CLAUDE.md).

### Phase 2 — `schema` escape hatch (separate commit, optional)

1. `kDataSchema` symbol in `fields/registry.ts`; `buildDocumentSchema`
   prefers it.
2. Builder support in `text`/`number`/`date`; server derives the descriptor's
   `jsonSchema` via `z.toJSONSchema(schema, { unrepresentable: 'any' })`.
3. Tests: symbol survives `stampFields`; `describe()` output is clean JSON
   (live schema stripped, `jsonSchema` present); server validation applies
   the refinement; client renders hints from `jsonSchema`.

### Non-goals

- Replacing the `Field` wire format wholesale with JSON Schema. Tier 2 adds
  `jsonSchema` as a *supplement* on fields that carry a live schema; the
  literal config remains the canonical wire shape that renderers and the
  storage generator consume.
- Accepting raw Zod objects in the *non-builder* field definition path. The
  plain-object `Field` shape stays literal; builders are the only sugar
  layer.

## Acceptance Criteria (Phase 1)

- `select({ options: ['a'] })` is a compile error; `z.enum` is the only form.
- `defaultValue: 'x'` where `'x'` is not in the enum is a compile error.
- `describe()` output for a select field is byte-identical to today
  (`options: string[]` on the wire).
- `pnpm -r typecheck` passes; no changes under `packages/core/src/fields/`
  (registry, builtins, types untouched).

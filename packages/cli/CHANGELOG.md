# @kon10/cli

## 1.0.3

### Patch Changes

- @kon10/client@1.0.3

## 1.0.2

### Patch Changes

- @kon10/client@1.0.2

## 1.0.1

### Patch Changes

- @kon10/client@1.0.1

## 1.0.0

### Minor Changes

- 80f291f: Add the `@kon10/cli` package with `kon10 typegen`. It reads a Studio's delivery
  manifest (`GET /api/v1/_manifest`) — from a running instance (`--url`) or a
  saved JSON file (`--manifest`) — and emits per-entity Zod schemas + inferred
  types plus a delivery-path → schema `entities` map. The generated Zod mirrors
  core's document validation field-by-field (per-type data schema, then
  `.default(v)` / `.nullable().optional()` wrapping, with `id` and timestamps as
  strings), and falls back to `z.unknown()` for module-registered field types.
  Feed the `entities` map into `@kon10/client`'s per-call `schema` option for
  typed, validated reads.

### Patch Changes

- Updated dependencies [5324e33]
- Updated dependencies [8267925]
  - @kon10/client@1.0.0

# @kon10/client-react

## 1.3.0

### Patch Changes

- @kon10/client@1.3.0

## 1.2.0

### Patch Changes

- @kon10/client@1.2.0

## 1.1.0

### Patch Changes

- @kon10/client@1.1.0

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

- 5324e33: Add the headless delivery client and a schema manifest endpoint.

  `@kon10/client` is a new framework-agnostic SDK over the public `/api/v1`
  content surface (`createDeliveryClient` with `list` / `get` / `single`,
  per-call Zod schemas, and a `DeliveryError` mapping of the response envelope),
  and `@kon10/client-react` adds `Kon10Provider` + `useList` / `useDoc` /
  `useSingle` hooks. The response-envelope contract (`apiResponseSchema`,
  `apiSuccess`, etc.) now lives in `@kon10/client` as the single source of truth
  shared with the server; `@kon10/start/envelope` re-exports it unchanged.

  `@kon10/start` adds `GET /api/v1/_manifest`, returning each readable entity's
  `prefix` / `slug` / `cardinality` / `kind` / `hierarchical` / `timestamps` and
  serialized (non-hidden) field configs — enough for a consumer or codegen to
  rebuild the document shapes the server validates. It is gated by the same read
  authorization as the entity's own reads.

### Patch Changes

- Updated dependencies [5324e33]
- Updated dependencies [8267925]
  - @kon10/client@1.0.0

# @kon10/client

## 1.2.0

## 1.1.0

## 1.0.3

## 1.0.2

## 1.0.1

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

- 8267925: Add publishable API keys (`rfcs/publishable-api-keys.md`).

  `@kon10/auth` gains two key classes distinguished by token prefix —
  `kon10_pk_` (publishable, safe to embed in client code) and `kon10_sk_`
  (secret, server-only); legacy `kon10_` tokens resolve as secret. The
  `api-keys` entity carries `type`, `allowedOrigins`, and `rateLimitPerMinute`;
  `ApiKeyPrincipal` exposes `publishable` and its guardrail config; and the RBAC
  guard caps publishable principals to read-only (unliftable, before any access
  predicate). New token helpers `apiKeyClassOf` / `PUBLISHABLE_TOKEN_PREFIX` /
  `SECRET_TOKEN_PREFIX` are exported.

  `@kon10/start` enforces the publishable-key guardrails on the delivery API and
  manifest: an origin allowlist (defense-in-depth) and a per-key fixed-window
  rate limit backed by the cache adapter, returning a new `429`
  `TOO_MANY_REQUESTS` envelope.

  `@kon10/client` throws if a secret key (`kon10_sk_…`) is passed to
  `createDeliveryClient` in a browser context, so keys can't be leaked into a
  bundle; use a publishable key client-side.

  The Studio API Keys page can create publishable keys and set their origins and
  rate limit.

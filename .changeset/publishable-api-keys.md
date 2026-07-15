---
"@kon10/auth": minor
"@kon10/start": minor
"@kon10/client": minor
---

Add publishable API keys (`rfcs/publishable-api-keys.md`).

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

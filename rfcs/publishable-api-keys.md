# RFC: Publishable API Keys

**Status:** Implemented
**Scope:** `@kon10/auth` (api-keys entity, token scheme, RBAC guard) + `@kon10/start`
(delivery-API enforcement) + `@kon10/client` (browser guard) + Studio key-management UI.
**Relation:** Enables the client-side path for the headless template system
(`rfcs/headless-templates.md`) without leaking a secret.

> **Implemented.** `kon10_pk_`/`kon10_sk_` token classes (legacy → secret);
> `type`/`allowedOrigins`/`rateLimitPerMinute` on the `api-keys` entity;
> `ApiKeyPrincipal.publishable`; the RBAC guard's read-only cap; delivery-API
> origin allowlist + per-key rate limit (`429 TOO_MANY_REQUESTS`); a
> `createDeliveryClient` guard that throws on a `kon10_sk_` key in the browser;
> and a Studio create-dialog type selector + guardrail inputs. The template's
> `VITE_` key footgun is documented as publishable-only. Open questions in §10
> (app-wide anonymous rate default, a "require pk_" switch, preview capability)
> remain future work.

---

## 1. Motivation

A headless content site reads the delivery API from somewhere. If that fetch
happens **in the browser** (a SPA, client-rendered components, CDN edge), any API
key shipped in the bundle is readable by every visitor — it is not a secret. Our
own `tanstack/blog` template currently wires `apiKey: import.meta.env.VITE_KON10_API_KEY`,
and Vite inlines `VITE_`-prefixed vars into the client bundle: a footgun that
teaches users to leak keys.

Today the two honest options are:

- **Server-only secret key** — real secret, but only works for SSR/SSG (the fetch
  must stay on the server).
- **Anonymous Public-role read** — correct for public content, but gives you no
  revocable, attributable, rate-limitable *handle* on that access.

**Publishable keys** are the missing middle, following the Stripe / Supabase-anon
model: a key **designed to be exposed** in client code, whose safety comes from
**scope**, not concealment. It lets a site do client-side reads of public content
with a revocable, rate-limited, attributable token — no secret, no true-anonymous
open door.

### The non-negotiable honesty

A publishable key is **not a secret**. Assume it is world-visible, because it will
be. Its guarantees must therefore hold *even when the token is public*:

- It can only do things you are fine with the whole world doing (read-only,
  published content).
- It does **not** make client-side content private. Private content still requires
  a **secret** key used **server-side**. Publishable keys make *public* access
  **managed**, not *private* access possible.

---

## 2. The Model

Two key classes, distinguished by a token sub-prefix so they can never be confused:

| Class | Token | Where it runs | Purpose |
|---|---|---|---|
| **Publishable** | `kon10_pk_…` | Browser / client bundle / CDN | Managed public reads |
| **Secret** | `kon10_sk_…` | Server only (SSR/SSG/CLI) | Broader/private reads, `kon10 typegen` |

Both still start with the existing `API_KEY_TOKEN_PREFIX` (`kon10_`), so the
delivery API's bearer detection (`token.startsWith('kon10_')`) is unchanged; the
class is read from the sub-prefix. **Legacy `kon10_<rand>` keys** (no `pk`/`sk`
segment) are treated as **secret** — additive, back-compatible.

---

## 3. Data Model Changes

### `api-keys` entity (`packages/modules/auth/src/api-keys/entities.ts`)

Add three fields (all additive — `migrate()` adds columns with defaults, per
`docs/concepts/migrations.md`):

```ts
// Zod-first field configs, stamped like the rest of the entity.
type: select({ options: ['secret', 'publishable'], defaultValue: 'secret' }),
allowedOrigins: /* string[] */ ,   // empty = no origin restriction
rateLimit: /* { requestsPerMinute: number } | null */ ,  // null = app default
```

`allowedOrigins` and `rateLimit` need a small representation decision (§10) — an
`array` field of a single text subfield, or a JSON-in-text column. `type` is a
plain `select`.

### Token scheme (`packages/modules/auth/src/api-keys/token.ts`)

```ts
export const API_KEY_TOKEN_PREFIX = 'kon10_'          // unchanged umbrella
export const PUBLISHABLE_PREFIX = 'kon10_pk_'
export const SECRET_PREFIX = 'kon10_sk_'

generateApiKeyToken(type: 'secret' | 'publishable')   // picks the sub-prefix
apiKeyClassOf(token): 'secret' | 'publishable'         // 'secret' for legacy
```

Generation stays client-side Web Crypto (as today); the Studio picks the class
before generating. Only the SHA-256 hash is stored; the display `prefix` becomes
`kon10_pk_Ab12…` / `kon10_sk_Ab12…`, still safe to show.

### Principal (`ApiKeyPrincipal` in `service.ts`)

`verifyApiKeyToken` resolves the class and carries it (plus the guardrail config)
on the principal, so downstream enforcement can read it opaquely:

```ts
interface ApiKeyPrincipal {
  id: string; kind: 'api-key'; name: string
  roles: string[]; permissions: string[]
  publishable: boolean          // NEW
  allowedOrigins?: string[]     // NEW
  rateLimit?: { requestsPerMinute: number }  // NEW
}
```

---

## 4. The Four Guardrails

### 4.1 Read-only cap — *core to the model*

A publishable principal can **only** perform `read`, regardless of the roles
attached or any entity `access` predicate. Enforced in the RBAC guard
(`packages/modules/auth/src/rbac/guard.ts`), **before** the access-predicate
deferral, so it is absolute:

```ts
return (ctx) => {
  if (ctx.context.enforce !== true) return
  // Publishable keys are read-only, period — cannot be lifted by roles or
  // an entity access predicate.
  if ((ctx.principal as { publishable?: boolean })?.publishable && ctx.operation !== 'read') {
    throw new AccessDeniedError(ctx.operation, ctx.slug)
  }
  // …existing access-predicate deferral + permission check…
}
```

The delivery API is GET-only anyway, but this makes the invariant hold **anywhere**
a `pk_` token is presented (the local operations API, a mis-wired RPC) — belt and
suspenders for a token you must assume is public.

### 4.2 Published-content only

The delivery API already applies each entity's `api.where` constraint (e.g.
`{ status: 'published' }`) to **every** read — drafts are only reachable via the
Studio RPC, never the delivery surface. This guardrail makes that an **explicit,
unliftable invariant for `pk_`**: a publishable key can never bypass `api.where`.

This future-proofs the templates RFC's **draft-preview** open question: when we
later let a **secret** key opt into unconstrained reads (preview/SSR of drafts,
e.g. a `preview` capability), `pk_` stays hard-capped to published content. The
delivery handler gates any future "bypass constraint" path on
`!principal.publishable`.

### 4.3 Origin allowlist — *defense-in-depth only*

A key may carry `allowedOrigins`. When set, the delivery API rejects requests
whose `Origin` header isn't in the list (and only echoes allowed origins in CORS
headers). Enforced in `@kon10/start`'s `resolveApiPrincipal` / request path in
`api.ts`.

**Honest limitation:** `Origin`/`Referer` are set by browsers but trivially
spoofed by any non-browser client (`curl`, a script). So this stops a leaked
`pk_` from being reused from *another website* in a normal browser — it does **not**
stop a determined scraper. It pairs with CORS but is not a security boundary;
§4.4 (rate limiting) and revocation are the real protections. We document it as
such so operators don't over-trust it.

### 4.4 Per-key rate limiting

Each key may carry `rateLimit` (default from app config; per-key override). The
delivery API enforces a fixed-window counter before dispatch, keyed on the key's
hash. Reuse the pattern of `login-throttle.ts`, but back it with the
**`CacheAdapter`** (`@kon10/cache`) so the window is shared across instances when
a real backend (redis `INCR` + TTL) is configured:

```
key: ratelimit:<keyHash>:<windowStart>   value: count   ttl: windowSeconds
```

**Honest limitation** (same as `login-throttle`): with the in-memory adapter this
is per-process — a brute-force speed bump on serverless, not a global guarantee.
With redis it is global. Anonymous/Public traffic can share an app-wide default
limit keyed on hashed identity.

---

## 5. Enforcement Flow

`@kon10/start`'s `handleDeliveryRequest` (and `_manifest`) gains two checks around
the existing principal resolution in `api.ts`:

```
resolveApiPrincipal (verify token → principal, class, origins, rateLimit)
  → if publishable + allowedOrigins set: reject when Origin ∉ allowedOrigins  (403)
  → rate-limit check on keyHash                                              (429)
  → opCtx { enforce: true } → operations → RBAC guard (read-only cap for pk) → api.where
```

A new `429 TOO_MANY_REQUESTS` joins the envelope's `API_ERROR_CODES`. Everything
else — the envelope, per-identity cache, hidden-field stripping — is unchanged.

---

## 6. Studio UX

On the API Keys settings page (`@kon10/auth/studio`):

- Choosing **Publishable** vs **Secret** at creation.
- **Secret** keys shown exactly once (as today).
- **Publishable** keys marked *safe to embed in client code* and re-viewable
  (they're not secret), with copy-ready `VITE_KON10_API_KEY=kon10_pk_…`.
- Manage `allowedOrigins` and `rateLimit` per key; list view shows the class.

---

## 7. Template & Client SDK Impact

- The `tanstack/blog` footgun is resolved: `VITE_KON10_API_KEY` is legitimately
  fine **when it holds a `pk_`** (that's what publishable means). The template's
  `lib/kon10.ts` documents: `VITE_KON10_*` = publishable only; secret keys are
  server-only (`process.env.KON10_API_KEY`, no `VITE_`).
- Optional DX guard: `@kon10/client` (or a lint rule) warns when a token starting
  with `kon10_sk_` is passed in a browser context.
- `kon10 typegen` uses a **secret** key (it runs in a CLI/CI — server-side), so
  it can introspect the full manifest.

---

## 8. Security Summary

| Concern | Publishable (`pk_`) | Secret (`sk_`) |
|---|---|---|
| Safe in browser bundle | Yes (by design) | **No** |
| Can write | No (hard cap) | Per roles |
| Sees drafts / bypasses `api.where` | Never | Potentially (future preview) |
| Origin-bindable | Yes (weak) | Yes |
| Rate-limited | Yes | Yes |
| Revocable / attributable | Yes | Yes |
| Makes client-side content *private* | **No** | Only if kept server-side |

The one-line rule: **publishable keys manage public access; they never make public
data secret.**

---

## 9. Migration & Back-compat

- All new fields are additive with defaults; `migrate()` adds columns, no drift.
- Existing `kon10_<rand>` keys have no class segment → resolved as **secret**
  (unchanged behavior).
- `verifyApiKeyToken`'s prefix check (`startsWith('kon10_')`) is unchanged; the
  class is derived from the sub-prefix, defaulting to secret.

---

## 10. Open Questions

- **Field representation** for `allowedOrigins` (string list) and `rateLimit`
  (small object): an `array` field vs. JSON-in-text vs. a small new field type.
- **App-wide defaults**: default rate limit for anonymous/Public and for keys
  lacking an explicit `rateLimit`; where it lives (`config.api`).
- **Anonymous vs. publishable**: should an app be able to *require* a `pk_`
  (disable true-anonymous reads) via a `config.api` switch, so every public read
  carries a revocable handle?
- **Preview capability**: the exact shape of the future "secret key may read
  drafts" path (a `preview` permission? a request flag gated on `!publishable`?),
  coordinated with the templates RFC's preview open question.
- **Rotation**: first-class key rotation (overlapping validity) or rely on
  create-new + revoke-old.

# @kon10/auth

## 1.2.0

## 1.1.0

### Minor Changes

- 296f18a: feat: create the first admin at `/setup` instead of from environment variables

  A fresh install now sends you to a framework-owned `/setup` screen to create the
  admin account, rather than expecting `ADMIN_EMAIL`/`ADMIN_PASSWORD` with a
  plaintext password in the environment. Once an admin exists the route closes
  itself and redirects to `/login`, and `/login` redirects _to_ setup while the
  install is still empty — so a fresh deploy can't strand you on a sign-in form
  with no account to use.

  Setup is a capability of the subject store, not an assumption: `SubjectStore`
  gains optional `count()` and `create()`, and a store that omits them (an
  external IdP, which owns its own account creation) reports setup as unsupported
  rather than half-serving it. `entitySubjectStore` implements both through the
  kernel's generic operations, so `@kon10/auth` still takes no dependency on
  `@kon10/users`.

  In production `/setup` additionally requires a token derived as
  `HMAC(AUTH_SECRET, 'kon10:setup')`. Deriving rather than storing it means every
  serverless instance agrees without shared state, no new env var is needed, and
  it goes inert the moment a user exists — closing the window where an unattended
  public deploy stays claimable by whoever finds the URL first. Development
  requires no token, so first run stays frictionless.

  `ADMIN_EMAIL`/`ADMIN_PASSWORD` still work when **both** are set, as an opt-in
  fast path for automation (CI, E2E, throwaway environments).

  New public surface: `Kon10Setup` and `kon10Start({ setupPath })` in
  `@kon10/start`; `client.setupStatus()` / `client.setup()`, `setupPath`, the
  `setup.*` extension zones, and `setupTitle`/`setupSubtitle` branding in
  `@kon10/studio-sdk`; `setupRoute`, `setupStatusRoute`, `setupToken`, and
  `CreateSubjectInput` in `@kon10/auth`.

### Patch Changes

- 11e36ed: feat: layout-shaped loading skeletons on Studio pages

  Every auto-generated Studio page now shows a skeleton that mirrors its own
  layout while it waits on data, instead of a bare centered spinner — the page
  keeps its shape and no longer reflows when content lands.

  `@kon10/studio-sdk` gains four composable, CMS-aware skeletons built on the
  `@kon10/ui` `Skeleton` primitive: `ListSkeleton` (header + table rows),
  `FormSkeleton` (header + toolbar + field rows, optional sidebar),
  `DashboardSkeleton` (stat-card grid), and the shared `PageHeaderSkeleton`.
  `LoadingState` remains the generic fallback and the app-boot indicator.

  `@kon10/start` wires these into the built-in views — list, create, edit, and
  global forms render the matching skeleton, and edit/global forms derive their
  skeleton's field count and sidebar from the loaded entity descriptor. Dashboard
  stat tiles use a small inline skeleton in place of the `·` placeholder.
  `@kon10/auth`'s API Keys settings page swaps its spinner for a list skeleton.

## 1.0.3

### Patch Changes

- Updated dependencies [e48077f]
  - @kon10/cache@1.0.3
  - @kon10/core@1.0.3
  - @kon10/studio-sdk@1.0.3
  - @kon10/ui@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [edeab7e]
  - @kon10/core@1.0.2
  - @kon10/studio-sdk@1.0.2
  - @kon10/cache@1.0.2
  - @kon10/ui@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [6e7fe1c]
- Updated dependencies [fe180c5]
- Updated dependencies [5c52497]
- Updated dependencies [424296e]
  - @kon10/core@1.0.1
  - @kon10/studio-sdk@1.0.1
  - @kon10/cache@1.0.1
  - @kon10/ui@1.0.1

## 1.0.0

### Minor Changes

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

### Patch Changes

- @kon10/cache@1.0.0
- @kon10/core@1.0.0
- @kon10/studio-sdk@1.0.0
- @kon10/ui@1.0.0

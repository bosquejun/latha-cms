---
'@kon10/auth': minor
'@kon10/studio-sdk': minor
'@kon10/start': minor
---

feat: create the first admin at `/setup` instead of from environment variables

A fresh install now sends you to a framework-owned `/setup` screen to create the
admin account, rather than expecting `ADMIN_EMAIL`/`ADMIN_PASSWORD` with a
plaintext password in the environment. Once an admin exists the route closes
itself and redirects to `/login`, and `/login` redirects *to* setup while the
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

# @kon10/auth — AuthModule

Session-based authentication, password hashing, RBAC, and publishable API keys — plus the Studio UI for roles/permissions and API-key management.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **`AuthModule`** — `module.ts` (`AuthModule`, `AuthModuleConfig`, `getCatalog`): wires session handling, the RBAC guard, and the auth API routes.
- **Sessions + crypto** — `session.ts`, `cookie.ts` (`serializeSetCookie`), `crypto.ts` (`hashPassword`, `verifyPassword`), `config.ts` (`resolveAuthOptions`, `AUTH_SECRET`/`DEV_SECRET`), `login-throttle.ts` (`loginBlocked`, `recordLoginFailure`, `clearLoginFailures`), `subject-store.ts`, `cache.ts`.
- **RBAC** — `rbac/` (`guard.ts` registered via `cms.registerGuard`, `permissions.ts`, `catalog.ts`, `resolve.ts`, `seed.ts`, `entities.ts`): roles, permissions, the seeded `admin` role and `SUPERADMIN`, and the `STUDIO_ACCESS` / `studio:access` gate.
- **Auth API** — `api/` (`login`, `logout`, `current-user`, `session-user`): the routes runners mount.
- **Publishable API keys** — `api-keys/` (`apiKeysEntity`, `API_KEYS_SLUG`, `service.ts`, `token.ts`): issue/verify keys for the delivery API.
- **Studio UI** — `studio/settings/*` (roles-permissions, api-keys), via the `./studio` barrel.

## Must never contain

- User-entity logic (that's `@kon10/users`) or content-entity logic. Auth manages *sessions and access*, not the `users` collection itself.

## Conventions specific to auth

- **RBAC vocabulary is generic access-control, not Studio branding.** Do not rename the seeded `admin` role, `SUPERADMIN`, or role names when Studio UI wording changes. `STUDIO_ACCESS` / `studio:access` *does* track the product name — it gates Studio entry — but the seeded role name does not. (See the root CLAUDE.md naming note.)
- Guards register in `onInit` and run **after** entity-level access predicates.
- `AUTH_SECRET` is required in production; `DEV_SECRET` is a dev-only fallback — never ship it.

## Tests

Extensive `node:test` coverage (`rbac/*`, `api/routes`, `login-throttle`, `api-keys/service`) against `dist/`.

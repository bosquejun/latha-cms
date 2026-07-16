# @kon10/users — UsersModule

Owns the `users` collection and user operations. The smallest feature module — a minimal CMS can run with just users and no content.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **`UsersModule`** — `module.ts` (`UsersModule`, `USERS_SLUG`, `UsersModuleConfig`): contributes the `users` entity.
- **Operations** — `operations.ts`: user CRUD helpers on top of the kernel operations layer.

## Must never contain

- Auth **session** logic — sessions, cookies, password verification, and RBAC live in `@kon10/auth`. This module owns the user *entity*; auth owns *who's logged in and what they can do*.

## Conventions specific to users

- Keep the boundary with `@kon10/auth` sharp: a user record is content-like data here; authentication and authorization are elsewhere. If a change touches sessions or permissions, it belongs in `@kon10/auth`.
- `USERS_SLUG` is the canonical slug — reference it, don't hardcode the string.

## Tests

`module.test.ts`, `operations.test.ts` via `node:test` against `dist/`.

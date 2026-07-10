# RBAC — Roles, Scopes & Permissions

Authorization in Kon10 is **role-based access control (RBAC)**, owned by
`@kon10/auth`. It is dynamic and database-backed: the *catalog* of what can be
granted is derived from your config, while *roles* and *who has them* are data
you manage in the Studio UI.

> The kernel (`@kon10/core`) knows nothing about users, roles, or permissions.
> It exposes a generic **guard seam** and an opaque **principal**; `@kon10/auth`
> plugs RBAC into that seam. See [Frameworks](./frameworks.md) for the request
> flow.

---

## The three entities

`@kon10/auth` contributes three entities (all in the Studio **Settings → Access**
area):

| Entity | Editable? | What it is |
|---|---|---|
| **Scope** | Catalog (synced) | A resource that can be acted on. One per entity (`posts`, `users`, …), plus the built-in `studio` scope and the superadmin `*`. |
| **Permission** | Catalog (synced) | A grantable `"<scope>:<action>"` pair, e.g. `posts:update`. |
| **Role** | You create | A named bundle of permissions. Users hold **many** roles; effective permissions are the union. |

### Permission keys & wildcards

A permission key is `"<scope>:<action>"`. Wildcards:

- `"*"` — superadmin: matches every permission.
- `"<scope>:*"` — every action within a scope (e.g. `posts:*`).
- `"*:<action>"` — an action across every scope (e.g. `*:read`).

Default actions per entity kind: collections get `read/create/update/delete`,
documents get `read/update`, taxonomies get `read/create/delete`.

---

## The catalog is synced from config

At boot, `AuthModule` derives the catalog from the live entity set — **one scope
per entity, with create/read/update/delete permissions** — and upserts it into
the `scopes`/`permissions` tables (pruning anything stale). So the catalog always
matches your config: add a `pages` collection and `pages:read` etc. appear
automatically, ready to assign to roles in the UI. You never hand-create scopes
or permissions.

Roles are the only hand-authored grants. On first run, a Strapi-style starter
set is seeded (override via `AuthModule({ roles })`):

| Role | System | Permissions |
|---|---|---|
| `admin` | ✓ | `*` (superadmin) |
| `editor` | | `studio:access` + read/create/update on non-sensitive scopes |
| `viewer` | | `studio:access` + read on non-sensitive scopes |
| `public` | ✓ | empty — grant public reads in the matrix |
| `authenticated` | ✓ | empty — baseline for every logged-in user |

**System roles** (`admin`, `public`, `authenticated`) can't be deleted (a
`beforeDelete` hook enforces it), but their permissions are editable. Sensitive
scopes (`users`, `roles`, `scopes`, `permissions`, `studio`) are reserved for the
superadmin. Refine roles freely in the Studio UI.

### Public & Authenticated

- **`public`** governs **unauthenticated** requests. An anonymous caller
  resolves to a synthetic principal carrying the Public role's permissions, so
  you grant public access by toggling permissions on Public — instead of
  hardcoding `access: read: () => true`. Public never holds `studio:access`, so it
  can't enter the Studio. Build a public/headless API with it:

  ```ts
  import { getPublicPrincipal } from '@kon10/auth'
  createContentApi({
    getKon10,
    enforce: true,
    getPrincipal: () => sessionUser ?? getPublicPrincipal(kon10),
  })
  ```

- **`authenticated`** is the baseline every logged-in user inherits: their
  effective permissions are the union of their explicit roles **plus** the
  Authenticated role. Grant app-wide defaults here.

---

## How enforcement works

Every operation runs through the kernel pipeline:

```
access predicate → guard chain → validation → hooks → DB
```

The RBAC guard (registered by `AuthModule`) enforces permissions, with two
important rules:

1. **Deny-by-default — but only when enforcing.** The guard checks a caller
   `context.enforce` flag. The Studio RPC layer sets it, so the Studio surface is
   deny-by-default: a write requires the matching `"<slug>:<action>"`
   permission. The **public local API** (`createContentApi` without `enforce`)
   leaves it off, so headless reads stay allow-by-default — the headless
   contract is unchanged.
2. **Explicit `access` overrides RBAC.** If a collection declares its own
   `access[operation]` predicate, that predicate is authoritative and the guard
   defers to it. This is how you opt a collection into public reads:

   ```ts
   Collection({
     slug: 'posts',
     access: { read: () => true }, // public headless reads; writes still RBAC-gated
     fields: { /* … */ },
   })
   ```

On top of per-operation checks, the RPC dispatcher applies a single top-level
gate: every Studio action (everything except `login`/`logout`/`currentUser`)
requires an authenticated principal holding `studio:access`.

---

## In the Studio UI

- The session carries the user's resolved `roles` and effective `permissions`.
- The sidebar only lists entities the user can **read**.
- New / Edit-delete / row-delete buttons are gated by `can('<slug>:create')`
  etc. via the `useCan()` hook (presentation only — the server re-checks every
  write).
- **Settings → Access** is a dedicated **Roles & Permissions matrix** (rows =
  scopes, columns = read/create/update/delete, grouped by module, plus the
  `studio:access` and superadmin toggles). Create/delete roles there; system
  roles show a badge and can't be deleted. The `scopes`/`permissions` catalog is
  surfaced through this page rather than its own nav entries.
- Assigning roles to a user uses the relationship field picker on the user form.

---

## Users hold roles

The `users` collection's `roles` field is a `relationship(many)` to `roles`.
Assign one or more roles per user; their effective permissions are the union.
Roles and permissions are re-resolved from the database on every request (the
session token only carries the user id), so a role change takes effect
immediately.

---

## Extending

- **More permissions per collection:** they already exist — every entity gets a
  scope with the standard actions. Grant the specific keys to a role.
- **A custom role set at install time:** pass `AuthModule({ roles: [...] })` with
  permission keys (wildcards allowed).
- **A non-RBAC rule for one collection:** write an explicit `access` predicate; it
  overrides the RBAC default for that operation.

## Running auth without the users module

Auth does not hard-depend on `@kon10/users`. It resolves identities through a
pluggable **subject store**:

- **Default:** reads the `users` collection (what `@kon10/users` provides).
- **Different collection:** `AuthModule({ usersSlug: 'accounts' })`.
- **Custom source (no users module):** supply a `subjectStore` returning
  `findByEmail` / `findById`, e.g. an external identity provider:

  ```ts
  AuthModule({
    secret: process.env.AUTH_SECRET!,
    subjectStore: () => ({
      findByEmail: (email) => myIdp.lookup(email),   // → { id, passwordHash, roles }
      findById: (id) => myIdp.get(id),
    }),
  })
  ```

The subject just needs an `id`, a `passwordHash` (for password login), and
`roles` (role ids) for RBAC resolution. Roles/scopes/permissions are owned by
auth itself, so RBAC works the same either way.

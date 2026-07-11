# @kon10/auth

Session authentication, RBAC, API keys, auth routes, and Studio settings for Kon10.

## Install

```bash
pnpm add @kon10/auth
```

## When to use this package

Use `@kon10/auth` when your Kon10 config needs session authentication, RBAC, API keys, auth routes, and Studio settings for Kon10.

## Public API

The primary entrypoint is `AuthModule`. See `src/index.ts` for the complete export surface, including types, helpers, and any Studio extension entrypoints.

## Example

```ts
import { AuthModule } from '@kon10/auth'

AuthModule({
  secret: process.env.AUTH_SECRET!,
})
```

## Operational notes

- Use with `@kon10/users` for the default subject store and user collection. Set `AUTH_SECRET` in production.
- Keep module-specific UI behind the `./studio` export when present.
- Prefer typed field builders and module factories over ad-hoc entity objects.

## Related documentation

- [Root README](../../../README.md)
- [Project specification](../../../SPEC.md)
- [Concept docs](../../../docs/concepts/README.md)

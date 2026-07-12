# @kon10/users

Default users collection and user operations for Kon10.

## Install

```bash
pnpm add @kon10/users
```

## When to use this package

Use `@kon10/users` when your Kon10 config needs default users collection and user operations for Kon10.

## Public API

The primary entrypoint is `UsersModule`. See `src/index.ts` for the complete export surface, including types, helpers, and any Studio extension entrypoints.

## Example

```ts
import { UsersModule } from '@kon10/users'

UsersModule({
  roles: ['admin', 'editor', 'viewer'],
})
```

## Operational notes

- Pair with `@kon10/auth` to authenticate users and resolve permissions.
- Keep module-specific UI behind the `./studio` export when present.
- Prefer typed field builders and module factories over ad-hoc entity objects.

## Related documentation

- [Root README](../../../README.md)
- [Project specification](../../../SPEC.md)
- [Concept docs](../../../docs/concepts/README.md)

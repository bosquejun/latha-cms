# @kon10/cache

Cache adapter implementations and helpers for Kon10 modules.

## Install

```bash
pnpm add @kon10/cache
```

## When to use this package

Use `@kon10/cache` when your Kon10 config needs cache adapter implementations and helpers for Kon10 modules.

## Public API

The primary entrypoint is `CacheModule`. See `src/index.ts` for the complete export surface, including types, helpers, and any Studio extension entrypoints.

## Example

```ts
import { CacheModule, redisCache } from '@kon10/cache'

CacheModule({
  adapter: redisCache({ url: process.env.REDIS_URL! }),
})
```

## Operational notes

- Use `inMemoryCache()` only for tests, local development, or single-instance deployments.
- Keep module-specific UI behind the `./studio` export when present.
- Prefer typed field builders and module factories over ad-hoc entity objects.

## Related documentation

- [Root README](../../../README.md)
- [Project specification](../../../SPEC.md)
- [Concept docs](../../../docs/concepts/README.md)

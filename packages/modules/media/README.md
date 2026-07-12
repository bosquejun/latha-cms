# @kon10/media

Media library module, upload route, storage adapters, and the `media()` field type.

## Install

```bash
pnpm add @kon10/media
```

## When to use this package

Use `@kon10/media` when your Kon10 config needs media library module, upload route, storage adapters, and the `media()` field type.

## Public API

The primary entrypoint is `MediaModule`. See `src/index.ts` for the complete export surface, including types, helpers, and any Studio extension entrypoints.

## Example

```ts
import { MediaModule, localDiskStorage } from '@kon10/media'

MediaModule({
  storage: localDiskStorage({ rootDir: './uploads', publicBaseUrl: '/uploads' }),
})
```

## Operational notes

- Use S3-compatible storage for shared or serverless deployments; local disk is best for development.
- Keep module-specific UI behind the `./studio` export when present.
- Prefer typed field builders and module factories over ad-hoc entity objects.

## Related documentation

- [Root README](../../../README.md)
- [Project specification](../../../SPEC.md)
- [Concept docs](../../../docs/concepts/README.md)

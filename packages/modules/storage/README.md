# @kon10/storage

Database adapters and schema generation for Kon10.

## Install

```bash
pnpm add @kon10/storage
```

## When to use this package

Use `@kon10/storage` when your Kon10 config needs database adapters and schema generation for Kon10.

## Public API

The primary entrypoint is `tursoAdapter`. See `src/index.ts` for the complete export surface, including types, helpers, and any Studio extension entrypoints.

## Example

```ts
import { tursoAdapter } from '@kon10/storage'

const db = tursoAdapter({ url: process.env.TURSO_DATABASE_URL ?? 'file:local.db' })
```

## Operational notes

- Turso/libsql is the default path; `postgresAdapter()` supports Postgres and Supabase.
- Keep module-specific UI behind the `./studio` export when present.
- Prefer typed field builders and module factories over ad-hoc entity objects.

## Related documentation

- [Root README](../../../README.md)
- [Project specification](../../../SPEC.md)
- [Concept docs](../../../docs/concepts/README.md)

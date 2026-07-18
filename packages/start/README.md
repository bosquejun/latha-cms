# @kon10/start

TanStack Start integration for Kon10. This package provides the Studio and login UI entrypoints, the server request dispatcher, route exports, response envelopes, and the Vite plugin that wires Kon10 into a TanStack Start application.

## Install

```bash
pnpm add @kon10/start @kon10/core @kon10/studio-sdk @kon10/ui @tanstack/react-start @tanstack/react-router react
```

## When to use this package

Use `@kon10/start` in application code. It is the bridge between a `kon10.config.ts` file and a runnable TanStack Start app with generated Studio routes and RPC endpoints.

## Public API

- `Kon10Provider`, `Kon10Studio`, and `Kon10Login`.
- `createKon10Client()` and RPC contract types re-exported from `@kon10/studio-sdk`.
- `handleKon10Request()` from `@kon10/start/server` for server functions.
- `kon10Start()` from `@kon10/start/vite` for route and extension collection.
- Route re-exports under `@kon10/start/routes/*`.
- API envelope helpers from `@kon10/start/envelope`.

## Example

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { kon10Start } from '@kon10/start/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [kon10Start(), viteReact()],
})
```

```ts
// src/rpc.ts
import { createServerFn } from '@tanstack/react-start'
import type { Kon10RpcInput } from '@kon10/start'
import config from '../kon10.config'

export const kon10Rpc = createServerFn({ method: 'POST' })
  .validator((data: Kon10RpcInput) => data)
  .handler(async ({ data }) => {
    const { handleKon10Request } = await import('@kon10/start/server')
    return handleKon10Request(config, data)
  })
```

## Operational notes

- Keep server-only imports behind `@kon10/start/server` to avoid client bundle leaks.
- Prefer the Vite plugin for generated routes; explicit route re-exports are supported for apps that want full control.
- Set a production `AUTH_SECRET` when using the auth module.

## Related documentation

- [Framework concepts](../../docs/concepts/frameworks.md)
- [Studio extensions](../../docs/studio-extensions.md)
- [Root README](../../README.md)

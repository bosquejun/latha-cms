# @kon10/cli

The Kon10 developer CLI. Today it ships `typegen`, which turns a Studio's
delivery manifest into typed content schemas for a consumer site.

## Install

```bash
pnpm add -D @kon10/cli
```

Or run without installing:

```bash
pnpm dlx @kon10/cli typegen --url https://cms.example.com
```

## `kon10 typegen`

Reads a Studio's delivery manifest (`GET /api/v1/_manifest`) — from a running
instance (`--url`) or a saved JSON file (`--manifest`) — and writes per-entity
Zod schemas plus inferred types.

```bash
kon10 typegen --url https://cms.example.com --out src/kon10.gen.ts
kon10 typegen --manifest ./manifest.json --out src/kon10.gen.ts
```

| Option | Description |
|---|---|
| `--url <baseUrl>` | Origin hosting the delivery API (fetches `/api/v1/_manifest`). |
| `--manifest <file>` | Read the manifest from a saved JSON file instead of `--url`. |
| `--api-key <key>` | API key for the fetch (or the `KON10_API_KEY` env var). Anonymous fetches only see Public-readable entities. |
| `--base-path <path>` | Delivery API base path (default `/api/v1`). |
| `--out <file>` | Output file (default `kon10.gen.ts`). |

The emitted Zod mirrors core's document validation field-by-field, so a consumer
validating a delivery response gets exactly what the server validated. Field
types core doesn't ship fall back to `z.unknown()` (real validation still runs
server-side).

### Using the output

```ts
import { createDeliveryClient } from '@kon10/client'
import { entities, type Posts } from './kon10.gen'

const kon10 = createDeliveryClient({ baseUrl: 'https://cms.example.com' })

const { data } = await kon10.list('contents/posts', { schema: entities['contents/posts'] })
//      ^? Posts[]
```

## Programmatic API

```ts
import { fetchManifest, generateTypes } from '@kon10/cli'

const manifest = await fetchManifest({ url: 'https://cms.example.com' })
const source = generateTypes(manifest)
```

## Related

- [`@kon10/client`](../clients/client) — the delivery client the output plugs into.
- The manifest endpoint lives in `@kon10/start` (`GET /api/v1/_manifest`).

# @kon10/client

The framework-agnostic headless delivery client for Kon10 — a thin, typed
wrapper over the public content API (`@kon10/start`'s `/api/v1` surface). It has
zero framework imports, so it runs unchanged in a TanStack loader, a React
Server Component, a Vue app, or a plain Node script.

## Install

```bash
pnpm add @kon10/client
```

## Usage

```ts
import { createDeliveryClient } from '@kon10/client'

const kon10 = createDeliveryClient({
  baseUrl: 'https://cms.example.com', // origin hosting /api/v1
  apiKey: process.env.KON10_API_KEY,  // optional; anonymous = Public role
})

// A page of documents from a `many` entity.
const { data, pagination } = await kon10.list('contents/posts', {
  page: 1,
  pageSize: 20,
  sort: '-createdAt',
  where: { status: 'published' },
})

// One document by id (null when it doesn't exist).
const post = await kon10.get('contents/posts', id)

// A singleton entity.
const settings = await kon10.single('site/settings')
```

### Typed results

Pass a Zod schema per call to validate and type the result. The forthcoming
`kon10 typegen` output plugs in here:

```ts
import { z } from 'zod'

const postSchema = z.object({ id: z.string(), title: z.string(), body: z.string() })
const { data } = await kon10.list('contents/posts', { schema: postSchema })
//      ^? { id: string; title: string; body: string }[]
```

Without a schema, documents come back as `JsonDoc` (`Record<string, unknown>`)
and are still validated to match the response envelope.

## Errors

- `get` / `single` return `null` on a `NOT_FOUND` (404).
- Every other failure throws a `DeliveryError` carrying the envelope's `code`,
  the HTTP `status`, and the `requestId` (when the server logged one).

## Related

- [`@kon10/client-react`](../client-react) — React hooks over this client.
- Envelope contract: `@kon10/client/envelope` (shared with `@kon10/start`).

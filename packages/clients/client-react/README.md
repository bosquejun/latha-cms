# @kon10/client-react

React hooks over [`@kon10/client`](../client), the headless delivery client.
This package is a thin binding — plain `useState`/`useEffect`, no data-fetching
library — so it stays a small wrapper around the framework-agnostic core.

## Install

```bash
pnpm add @kon10/client-react @kon10/client react
```

## Usage

```tsx
import { createDeliveryClient } from '@kon10/client'
import { Kon10Provider, useList, useDoc, useSingle } from '@kon10/client-react'

const client = createDeliveryClient({ baseUrl: 'https://cms.example.com' })

function App({ children }: { children: React.ReactNode }) {
  return <Kon10Provider client={client}>{children}</Kon10Provider>
}

function PostList() {
  const { data, pagination, isLoading, error, refetch } = useList('contents/posts', {
    sort: '-createdAt',
    where: { status: 'published' },
  })
  if (isLoading) return <p>Loading…</p>
  if (error) return <p>{error.message}</p>
  return <ul>{data?.map((p) => <li key={String(p.id)}>{String(p.title)}</li>)}</ul>
}

function Post({ id }: { id: string }) {
  const { data } = useDoc('contents/posts', id) // null when missing
  return data ? <article>{String(data.title)}</article> : null
}

function Settings() {
  const { data } = useSingle('site/settings')
  return <footer>{String(data?.siteName)}</footer>
}
```

Each hook re-runs when its request key (path + query params) changes and aborts
the in-flight request on unmount. Pass a `schema` in the options for typed,
validated results — see [`@kon10/client`](../client).

## Related

- [`@kon10/client`](../client) — the framework-agnostic core and envelope contract.

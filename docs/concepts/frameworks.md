# Frameworks — integrating LathaCMS into a host framework

LathaCMS is config-driven and framework-agnostic at its core
([`@latha/core`](../../packages/core)). A **framework-integration package**
adapts that core to a specific host framework — its routing, its server runtime,
its bundler. Today there is one: [`@latha/start`](../../packages/start), for
**TanStack Start**. The pattern below is what any future adapter would follow.

> **Goal:** the consuming app declares *what* its CMS is (the config) and
> nothing about *how* it's wired. `@latha/start` owns the wiring.

---

## The whole app surface

A complete LathaCMS app has just **three** integration touchpoints:

```
your-app/
├── latha.config.ts          1. WHAT your CMS is (schema, db, auth, admin)
├── vite.config.ts           2. lathaStart()         — the plugin
└── src/routes/__root.tsx     3. <LathaProvider>      — the mount
```

Everything else (`/login`, the admin UI, and the RPC endpoint) is provided by
the package. There is **no hand-written server function and no RPC file**.

### 1. `latha.config.ts` — the source of truth

```ts
import { defineConfig } from '@latha/core'
export default defineConfig({ db, modules, seed })
```

### 2. `vite.config.ts` — one plugin

```ts
import { lathaStart } from '@latha/start/vite'
export default defineConfig({ plugins: [ …, lathaStart(), viteReact() ] })
```

`lathaStart()` wraps TanStack Start's Vite plugin and:

- injects three framework routes via TanStack's **virtual file routes** —
  `/login`, `/admin/$`, and the RPC endpoint `/__latha/rpc`;
- resolves `virtual:latha/config` to the app's `latha.config` module, so the RPC
  route can reach the config without the app importing anything.

### 3. `__root.tsx` — one provider

```ts
import { LathaProvider } from '@latha/start'

<LathaProvider basePath="/admin" loginPath="/login">
  <Outlet />
</LathaProvider>
```

`client` is optional — it defaults to `createLathaClient()`, which talks to the
framework RPC route. Pass one only to customize the transport (see below).

---

## The RPC endpoint is a server route

The whole admin surface is served by **one** TanStack Start server route, owned
by the package ([`routes/rpc.ts`](../../packages/start/src/routes/rpc.ts)):

```ts
createFileRoute('/__latha/rpc')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const data = await request.json()
        const [{ default: config }, { dispatchLathaRpc }] = await Promise.all([
          import('virtual:latha/config'),  // the app's config
          import('../server.js'),          // server-only dispatcher
        ])
        return Response.json(await dispatchLathaRpc(config, data))
      },
    },
  },
})
```

It registers in the app's generated route tree exactly like any other route — it
is a first-class TanStack route, not a side channel. See
[Taxonomy → RPC vs API](./taxonomy.md#rpc-vs-api) for why the *contract* is RPC
while the *transport* is a server route.

---

## The typed client

The admin components never touch the server directly — they call a
[`LathaClient`](../../packages/start/src/client.ts), one method per RPC action:

```ts
const latha = createLathaClient()          // POSTs to /__latha/rpc
await latha.list('posts')
await latha.create('posts', { title: 'Hi' })
```

`createLathaClient()` defaults to a `fetch` transport against the RPC route, so
no app wiring is needed. All admin data-loading happens client-side (in effects /
event handlers), so a relative-URL `fetch` is safe during SSR.

---

## The client / server boundary

The RPC route's handler is **server-only**: both the config (which pulls in the
db adapter) and the dispatcher (which reads/writes cookies) are loaded with
dynamic `import()` *inside* the handler. TanStack Start strips server-route
handlers from the client build, so none of that server code — and nothing it
imports — reaches the browser bundle. The client ships only the `fetch` stub.

This split is the reason the endpoint can't be a pre-built helper shipped from
the package and called as `createLathaClient(config)`: TanStack's compiler only
performs the client/server split on code it compiles in the app, so the boundary
must live in app-compiled code (here, the injected route file).

---

## Customizing the transport

The default is zero-config, but the seam is open:

| You want to… | Do this |
|---|---|
| Use a different endpoint path | `createLathaClient({ endpoint: '/my/path' })` |
| Wrap dispatch in your own `createServerFn` | build a `LathaServerFn`, then `createLathaClient(serverFn)` or `createLathaClient({ serverFn })` |
| Validate input in a custom server function | use `lathaRpcValidator` from `@latha/start` |
| Call the dispatcher yourself (server-side) | `dispatchLathaRpc(config, input)` from `@latha/start/server` |

The server-only dispatcher lives behind the `@latha/start/server` subpath
precisely so it is never pulled into a client-reachable import graph.

---

## What an adapter owns (the pattern)

A framework-integration package is responsible for:

1. **Routes** — login, the admin catch-all, and the RPC endpoint, injected so
   the app writes none of them.
2. **The RPC transport** — receive a request, dispatch one `LathaRpcInput`
   against the runtime, return JSON.
3. **The client** — a `LathaClient` bound to that transport.
4. **The runtime** — bootstrap + seed one `LathaInstance` per config, memoized.
5. **The provider** — make the client + mount paths available to the admin UI.

Anything CMS-generic (schema, access, hooks, operations) stays in `@latha/core`;
anything UI-generic stays in `@latha/ui` / `@latha/admin-sdk`. The adapter is the
thin, framework-specific seam between them.

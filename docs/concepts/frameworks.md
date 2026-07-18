# Frameworks — integrating Kon10 into a host framework

Kon10 is config-driven and framework-agnostic at its core
([`@kon10/core`](../../packages/core)). A **framework-integration package**
adapts that core to a specific host framework — its routing, its server runtime,
its bundler. Today there is one: [`@kon10/start`](../../packages/start), for
**TanStack Start**. The pattern below is what any future adapter would follow.

> **Goal:** the consuming app declares *what* its CMS is (the config) and
> nothing about *how* it's wired. `@kon10/start` owns the wiring.

---

## The whole app surface

A complete Kon10 app has just **three** integration touchpoints:

```
your-app/
├── kon10.config.ts          1. WHAT your CMS is (schema, db, auth, studio)
├── vite.config.ts           2. kon10Start()         — the plugin
└── src/routes/__root.tsx     3. <Kon10Provider>      — the mount
```

Everything else (`/login`, the Studio UI, and the RPC endpoint) is provided by
the package. There is **no hand-written server function and no RPC file**.

### 1. `kon10.config.ts` — the source of truth

```ts
import { defineConfig } from '@kon10/core'
export default defineConfig({ db, modules, seed })
```

### 2. `vite.config.ts` — one plugin

```ts
import { kon10Start } from '@kon10/start/vite'
export default defineConfig({ plugins: [ …, kon10Start(), viteReact() ] })
```

`kon10Start()` wraps TanStack Start's Vite plugin and:

- injects three framework routes via TanStack's **virtual file routes** —
  `/login`, `/studio/$`, and the RPC endpoint `/__kon10/rpc`;
- resolves `virtual:kon10/config` to the app's `kon10.config` module, so the RPC
  route can reach the config without the app importing anything.

### 3. `__root.tsx` — one provider

```ts
import { Kon10Provider } from '@kon10/start'

<Kon10Provider basePath="/studio" loginPath="/login">
  <Outlet />
</Kon10Provider>
```

`client` is optional — it defaults to `createKon10Client()`, which talks to the
framework RPC route. Pass one only to customize the transport (see below).

---

## The RPC endpoint is a server route

The whole Studio surface is served by **one** TanStack Start server route, owned
by the package ([`routes/rpc.ts`](../../packages/start/src/routes/rpc.ts)):

```ts
createFileRoute('/__kon10/rpc')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const data = await request.json()
        const [{ default: config }, { dispatchKon10Rpc }] = await Promise.all([
          import('virtual:kon10/config'),  // the app's config
          import('../server.js'),          // server-only dispatcher
        ])
        return Response.json(await dispatchKon10Rpc(config, data))
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

The Studio components never touch the server directly — they call a
[`Kon10Client`](../../packages/start/src/client.ts), one method per RPC action:

```ts
const kon10 = createKon10Client()          // POSTs to /__kon10/rpc
await kon10.list('posts')
await kon10.create('posts', { title: 'Hi' })
```

`createKon10Client()` defaults to a `fetch` transport against the RPC route, so
no app wiring is needed. All Studio data-loading happens client-side (in effects /
event handlers), so a relative-URL `fetch` is safe during SSR.

---

## The client / server boundary

The RPC route's handler is **server-only**: both the config (which pulls in the
db adapter) and the dispatcher (which reads/writes cookies) are loaded with
dynamic `import()` *inside* the handler. TanStack Start strips server-route
handlers from the client build, so none of that server code — and nothing it
imports — reaches the browser bundle. The client ships only the `fetch` stub.

This split is the reason the endpoint can't be a pre-built helper shipped from
the package and called as `createKon10Client(config)`: TanStack's compiler only
performs the client/server split on code it compiles in the app, so the boundary
must live in app-compiled code (here, the injected route file).

---

## Customizing the transport

The default is zero-config, but the seam is open:

| You want to… | Do this |
|---|---|
| Use a different endpoint path | `createKon10Client({ endpoint: '/my/path' })` |
| Wrap dispatch in your own `createServerFn` | build a `Kon10ServerFn`, then `createKon10Client(serverFn)` or `createKon10Client({ serverFn })` |
| Validate input in a custom server function | use `kon10RpcValidator` from `@kon10/start` |
| Call the dispatcher yourself (server-side) | `dispatchKon10Rpc(config, input)` from `@kon10/start/server` |

The server-only dispatcher lives behind the `@kon10/start/server` subpath
precisely so it is never pulled into a client-reachable import graph.

---

## What an adapter owns (the pattern)

A framework-integration package is responsible for:

1. **Routes** — login, the Studio catch-all, and the RPC endpoint, injected so
   the app writes none of them.
2. **The RPC transport** — receive a request, dispatch one `Kon10RpcInput`
   against the runtime, return JSON.
3. **The client** — a `Kon10Client` bound to that transport.
4. **The runtime** — bootstrap + seed one `Kon10Instance` per config, memoized.
5. **The provider** — make the client + mount paths available to the Studio UI.

Anything CMS-generic (schema, access, hooks, operations) stays in `@kon10/core`;
anything UI-generic stays in `@kon10/ui` / `@kon10/studio-sdk`. The adapter is the
thin, framework-specific seam between them.

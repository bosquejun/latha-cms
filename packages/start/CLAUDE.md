# @kon10/start — TanStack Start Integration

The runner. Turns a `kon10.config.ts` + a mounted `<Kon10Provider>` into a working app: typed client, React provider, the whole Studio + login UI, the RPC endpoint, and the public delivery REST API.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **RPC dispatcher + server routes** — `routes/rpc.ts`, `routes/modules.ts`, `routes/api.ts`, `routes/login.tsx`, `routes/studio.tsx`; the server dispatcher (`server.ts`) is exported from `@kon10/start/server`, kept separate so server-only imports never reach the client bundle.
- **Delivery REST API** — `api.ts` (mounts the read-only `/api/v1/...` surface, applies `api.cors` / read-through cache, `/_manifest` schema endpoint).
- **Vite plugin** — `vite.ts` (`@kon10/start/vite`): statically imports each module/plugin's `studio.ui` barrel and merges the Studio extension registry at build time; feeds the `virtual:kon10` module.
- **Runtime + envelope** — `runtime.ts`, `envelope.ts` (re-exports the delivery response envelope, Zod-first, shared with `@kon10/client`), `hidden-fields.ts`, principal resolution.
- **Public surface** — `index.ts` re-exports the client (`createKon10Client`, `Kon10Client`), `Kon10Provider`/`useKon10`, `Kon10Studio`, `Kon10Login`, the RPC path constants, and the full Studio-extension authoring API (`defineStudioExtensions`, `defineWidgetConfig`, `Slot`, `registerFieldRenderer`, `STUDIO_ZONES`, …) so apps import from one place.

## Must never contain

- Business logic. This is glue between TanStack Start and the kernel/modules — persistence, access rules, and field behavior live in core and the modules.

## Conventions specific to start

- **Server/client split is load-bearing.** Anything importing Node/server-only code goes behind `@kon10/start/server`; the default entry must stay client-safe.
- The Vite plugin resolves `studio.ui` as **serializable import specifiers** (e.g. `'@kon10/slug/studio'`), never component references — that's how Studio UI is contributed without a build-time dep on each module.
- Exports are grouped by subpath (`./server`, `./vite`, `./routes/*`, `./envelope`) — respect those boundaries when adding surface.

## Tests

Unit + integration (`integration/*.test.ts`, including full-stack Turso) via `node:test` against `dist/`. Browser E2E lives in `apps/playground/e2e`, not here.

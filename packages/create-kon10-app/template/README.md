# Your Kon10 app

Scaffolded with `create-kon10-app`. [Kon10](https://github.com/bosquejun/kon10)
is a config-driven, modular headless CMS built on TanStack Start.

## Getting started

```bash
pnpm install   # or npm install / yarn
pnpm dev       # http://localhost:3000
```

On first run the app seeds an admin user so you can sign in at
[/studio](http://localhost:3000/studio):

```
email:    admin@kon10.dev   (override with ADMIN_EMAIL)
password: password          (override with ADMIN_PASSWORD)
```

> **Change that password immediately** — especially before deploying.

## What's here

| File | What it is |
|---|---|
| `kon10.config.ts` | The entire CMS: database, modules, collections, seed. Start here. |
| `vite.config.ts` | `kon10Start()` injects `/login`, `/studio/$`, the RPC and the delivery API. |
| `src/routes/` | Your app's own pages (the Studio ships from the framework). |
| `src/studio/` | Optional Studio extensions (widgets, pages) — create it when needed. |
| `.env` | `AUTH_SECRET` (generated for you) and other secrets. Not committed. |

The content you model in `kon10.config.ts` is served read-only at
`/api/v1/<module>/<collection>` and editable in the Studio.

## Environment variables

- `AUTH_SECRET` — **required in production**; a generated one is in `.env`.
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — point at Turso in production
  (defaults to a local `file:local.db` SQLite database).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — first-run admin seed overrides.
- `KON10_LOG_LEVEL` — `debug` | `info` (default) | `warn` | `error` | `silent`.

## Build & deploy

```bash
pnpm build     # produces .output/ via Nitro
pnpm start     # node .output/server/index.mjs
```

Docs: <https://github.com/bosquejun/kon10/tree/main/docs>

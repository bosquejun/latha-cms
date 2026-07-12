# Deploying Kon10 to production

A checklist for taking a Kon10 app from `pnpm dev` to a real deployment.

## Required

### `AUTH_SECRET`

Session tokens are HMAC-signed with `AUTH_SECRET`. **The runtime refuses to
boot in production without it** (`NODE_ENV=production`). Set it to a
cryptographically random string of 32+ bytes:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Apps scaffolded with `create-kon10-app` get one generated into `.env` — make
sure that value (or a fresh one) reaches your production environment, and that
`.env` never lands in git.

### Change the seeded admin password

The first-run seed creates an admin (default `admin@kon10.dev` / `password`)
so you can sign in immediately. In production either:

- set `ADMIN_EMAIL` / `ADMIN_PASSWORD` **before the first boot**, or
- sign in right after the first deploy and change the password in
  **Studio → Settings → Users**.

Never leave the default password live.

## Database

The default config uses a local SQLite file (`file:local.db`) — fine for dev,
wrong for most production deploys (serverless filesystems are ephemeral).

- **Turso** (libsql): set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; the
  default `tursoAdapter` picks them up.
- **Postgres / Supabase**: use `postgresAdapter` from `@kon10/storage`.

Schema reconciliation runs automatically at boot and is **additive only** —
read [migrations](./concepts/migrations.md) before renaming or retyping
fields.

## Media storage

`localDiskStorage` writes to the app's filesystem — dev only. Production
deploys should use `s3Storage` from `@kon10/media` (AWS S3, Cloudflare R2, or
any S3-compatible store).

## Cache

`inMemoryCache()` is per-process; on serverless it resets per instance. For a
shared delivery-API cache use `redisCache` from `@kon10/cache`.

## Rate limiting

The built-in login throttle is a **per-instance, in-memory speed bump** —
after repeated failures for an email it refuses attempts for a few minutes,
per process. It is not a hard guarantee: serverless platforms run many
instances and each counts separately. Put a real rate limiter (platform edge
rules, a WAF, or a reverse proxy) in front of `/login` and the RPC endpoint
for hard limits.

## Logging & traceability

Kon10 logs one structured line per request (RPC and delivery API) through the
logger configured in `kon10.config.ts` — the console-backed default needs no
setup. Useful knobs:

- `KON10_LOG_LEVEL` — `debug` | `info` (default) | `warn` | `error` | `silent`.
  `debug` adds module lifecycle and migration lines at boot.
- `logger` config key — any pino-shaped logger drops in:
  `defineConfig({ logger: pino(), … })`.
- Every failure response carries an `error.requestId`; the same id is on the
  server log line, so a client-reported error can be matched to its logs.

### Redaction

The built-in logger redacts sensitive values before anything is written: any
logged property whose name contains one of the default stems — `password`,
`passwd`, `secret`, `token`, `apikey`, `api_key`, `authorization`, `cookie`,
`credential`, `keyhash`, `privatekey`, `private_key` — is replaced with
`[REDACTED]`, case-insensitively and recursively through nested objects and
arrays. This is deliberately substring-based (so `passwordHash`, `dbToken`,
and `Authorization` are all caught), erring toward over-redaction.

- **Extend** the stems with `KON10_LOG_REDACT` (comma-separated), e.g.
  `KON10_LOG_REDACT=ssn,internalNote`, or programmatically via
  `consoleLogger({ redact: ['ssn'] })`.
- **Disable** (not recommended) with `consoleLogger({ redact: false })`.
- **Custom loggers redact themselves**: if you pass your own `logger` (e.g.
  pino), Kon10 hands it raw objects — configure that logger's own redaction
  (pino's `redact` option).

## CORS

The delivery API defaults to `Access-Control-Allow-Origin: *` — public
content is meant to be fetched cross-origin. Restrict it per app via
`api.cors` in the config (an origin allowlist, or `false` for none).

## Vercel

TanStack Start + Nitro auto-detect Vercel at build time. The playground's
`kon10.config.vercel.ts` in the Kon10 repo is a working reference for the
Postgres + S3 + Redis combination, including how to keep the local-dev and
Vercel adapter module graphs separate.

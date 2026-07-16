# @kon10/client — Headless Delivery SDK

Framework-agnostic, read-only SDK over the public delivery API (`/api/v1/...`). This is what an external site/app uses to fetch published content. It talks **HTTP only** — no kernel, no server internals.

See root [`CLAUDE.md`](../../../CLAUDE.md) for global rules.

## Owns

- **Delivery client** — `client.ts` (`createDeliveryClient`, `DeliveryClient`, `DeliveryClientOptions`, `DeliveryError`, `DEFAULT_API_PATH`, `ListOptions`/`GetOptions`/`ListResult`, `JsonDoc`, `WhereValue`): typed `list`/`get`/single fetching against the delivery API.
- **Response envelope** — `envelope.ts` (`API_ERROR_CODES`, `apiResponseSchema`, `apiSuccess`/`apiFailure`, `apiPaginationOf`, `ApiResponse`/`ApiError`/`ApiPagination`): the Zod-first wire-format contract, the **single source of truth** shared with `@kon10/start` (which re-exports it) and consumed by `@kon10/cli`.

## Must never contain

- Any server or kernel internals. It only knows the HTTP surface of the delivery API and the envelope schema. No database, no RPC, no auth session logic.

## Conventions specific to client

- The envelope here is authoritative — `@kon10/start` re-exports it rather than redefining, so the wire format never diverges. Change it here, not in two places.
- Zod-first: response shapes are schemas first, types inferred.
- `@kon10/client-react` provides React bindings on top of this; keep this package framework-agnostic.

## Tests

`client.test.ts` via `node:test` against `dist/`.

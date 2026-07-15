---
"@kon10/client": minor
"@kon10/client-react": minor
"@kon10/start": patch
---

Add the headless delivery client. `@kon10/client` is a new framework-agnostic
SDK over the public `/api/v1` content surface (`createDeliveryClient` with
`list` / `get` / `single`, per-call Zod schemas, and a `DeliveryError` mapping
of the response envelope), and `@kon10/client-react` adds `Kon10Provider` +
`useList` / `useDoc` / `useSingle` hooks. The response-envelope contract
(`apiResponseSchema`, `apiSuccess`, etc.) now lives in `@kon10/client` as the
single source of truth shared with the server; `@kon10/start/envelope`
re-exports it unchanged.

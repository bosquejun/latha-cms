import { createDeliveryClient } from '@kon10/client'

/**
 * The Kon10 delivery client for this site.
 *
 * `VITE_KON10_URL` is your Studio's origin — the host serving `/api/v1`
 * (e.g. `https://cms.example.com`). It is not secret.
 *
 * `VITE_KON10_API_KEY` must be a **publishable** key (`kon10_pk_…`). Vite
 * inlines `VITE_`-prefixed vars into the browser bundle, so only a publishable
 * key belongs here — it is designed to be exposed and is capped to read-only,
 * published content. NEVER put a secret key (`kon10_sk_…`) in a `VITE_` var;
 * pass those from a server-only env (`process.env.KON10_API_KEY`) in loaders.
 * Omit the key entirely to read as the anonymous Public role.
 *
 * Run `npx @kon10/cli typegen --url $VITE_KON10_URL` to generate typed schemas,
 * then pass them per call: `kon10.list('contents/posts', { schema: entities['contents/posts'] })`.
 */
export const kon10 = createDeliveryClient({
  baseUrl: import.meta.env.VITE_KON10_URL,
  apiKey: import.meta.env.VITE_KON10_API_KEY,
})

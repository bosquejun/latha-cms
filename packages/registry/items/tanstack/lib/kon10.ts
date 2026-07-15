import { createDeliveryClient } from '@kon10/client'

/**
 * The Kon10 delivery client for this site.
 *
 * Point `VITE_KON10_URL` at your Studio's origin — the host serving `/api/v1`
 * (e.g. `https://cms.example.com`). Set `VITE_KON10_API_KEY` to read content
 * that isn't exposed to the anonymous Public role.
 *
 * Run `npx @kon10/cli typegen --url $VITE_KON10_URL` to generate typed schemas,
 * then pass them per call: `kon10.list('contents/posts', { schema: entities['contents/posts'] })`.
 */
export const kon10 = createDeliveryClient({
  baseUrl: import.meta.env.VITE_KON10_URL,
  apiKey: import.meta.env.VITE_KON10_API_KEY,
})

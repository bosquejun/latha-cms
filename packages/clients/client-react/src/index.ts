/**
 * `@kon10/client-react` — React hooks over `@kon10/client`.
 *
 * Wrap your tree in `<Kon10Provider client={…}>`, then call `useList` /
 * `useDoc` / `useSingle`. The client core and the envelope contract are
 * re-exported from `@kon10/client`; import those directly from there.
 */
export { Kon10Provider, useDeliveryClient, type Kon10ProviderProps } from './context.js'
export {
  useList,
  useDoc,
  useSingle,
  type UseListResult,
  type UseDocResult,
} from './hooks.js'

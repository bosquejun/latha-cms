/**
 * The app's RPC endpoint + typed client, in one place.
 *
 * The `createServerFn` boundary has to live in app code — TanStack Start splits
 * the handler off the client bundle by file, so it can't be shipped pre-built
 * from `@latha/start`. The package still owns the pieces: `lathaRpcValidator`
 * (client-safe) and `dispatchLathaRpc` (server-only, pulled in lazily so its
 * cookie/db imports never reach the client). To customize dispatch, swap in your
 * own server function — `createLathaClient` accepts any `LathaServerFn`.
 */

import { createServerFn } from '@tanstack/react-start'
import {
  createLathaClient,
  lathaRpcValidator,
  type LathaServerFn,
} from '@latha/start'
import config from '../latha.config'

export const lathaRpc = createServerFn({ method: 'POST' })
  .validator(lathaRpcValidator)
  .handler(async ({ data }) => {
    const { dispatchLathaRpc } = await import('@latha/start/server')
    return dispatchLathaRpc(config, data)
  })

export const latha = createLathaClient(lathaRpc as unknown as LathaServerFn)

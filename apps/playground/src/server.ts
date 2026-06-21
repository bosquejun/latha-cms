/**
 * The app's one and only server endpoint.
 *
 * It forwards every admin/API request to LathaCMS. The server-only dispatcher
 * is pulled in with a dynamic `import()` so its cookie/db imports never reach
 * the client bundle.
 */

import { createServerFn } from '@tanstack/react-start'
import type { LathaRpcInput } from '@latha/start'
import type { JsonValue } from '@latha/core'
import config from '../latha.config'

export const lathaRpc = createServerFn({ method: 'POST' })
  .validator((data: LathaRpcInput) => data)
  .handler(async ({ data }): Promise<JsonValue> => {
    const { handleLathaRequest } = await import('@latha/start/server')
    return (await handleLathaRequest(config, data)) as JsonValue
  })

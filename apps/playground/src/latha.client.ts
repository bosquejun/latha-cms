/**
 * The typed Latha client, bound to the app's server endpoint. Shared by the
 * provider in `__root` and any custom UI that wants to call the CMS.
 */

import { createLathaClient, type LathaServerFn } from '@latha/start'
import { lathaRpc } from './server'

export const latha = createLathaClient(lathaRpc as unknown as LathaServerFn)

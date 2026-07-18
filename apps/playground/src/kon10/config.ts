import {
  defineConfig,
  type CacheAdapter,
  type DBAdapter,
  type ResolvedConfig,
  type StorageAdapter,
} from '@kon10/core'
import { inMemoryCache } from '@kon10/cache'
import { createModules } from './modules/index.js'
import { createPlugins } from './plugins.js'
import { seed } from './seed.js'
import { studio } from './studio.js'

export interface PlaygroundAdapters {
  db: DBAdapter
  storage: StorageAdapter
  cache?: CacheAdapter
}

export function createKon10Config({
  db,
  storage,
  cache = inMemoryCache(),
}: PlaygroundAdapters): ResolvedConfig {
  return defineConfig({
    db,
    studio,
    plugins: createPlugins(),
    modules: createModules({ storage, cache }),
    seed,
  })
}

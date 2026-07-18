import type { CacheAdapter, Module, StorageAdapter } from '@kon10/core'
import { AuthModule } from '@kon10/auth'
import { CacheModule } from '@kon10/cache'
import { MediaModule } from '@kon10/media'
import { UsersModule } from '@kon10/users'
import { createContentModule } from './content.js'

export interface PlaygroundModuleAdapters {
  storage: StorageAdapter
  cache: CacheAdapter
}

export function createModules({
  storage,
  cache,
}: PlaygroundModuleAdapters): Module[] {
  return [
    UsersModule(),
    AuthModule({
      secret: process.env.AUTH_SECRET ?? 'kon10-dev-secret-change-me',
    }),
    MediaModule({ storage }),
    CacheModule({ cache }),
    createContentModule(),
  ]
}

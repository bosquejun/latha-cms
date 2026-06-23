/**
 * LathaProvider / useLatha — makes the client + mount paths available to the
 * admin components without prop-drilling.
 *
 * It also hosts the admin extension system: any `extensions` passed in are
 * normalized into a registry, field-renderer overrides are registered, and the
 * registry is published via `<ExtensionsProvider>` so the shell, the views, and
 * every `<Slot>` can read it.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  ExtensionsProvider,
  createExtensionRegistry,
  registerFieldRenderer,
  type AdminExtensions,
  type ExtensionRegistry,
} from '@latha/admin-sdk'
import type { LathaClient } from './client.js'

export interface LathaContextValue {
  client: LathaClient
  /** Base path the admin is mounted under. Defaults to `/admin`. */
  basePath: string
  /** Where to send unauthenticated users. Defaults to `/login`. */
  loginPath: string
  /** The resolved extension registry (empty when no extensions are provided). */
  extensions: ExtensionRegistry
}

const LathaContext = createContext<LathaContextValue | null>(null)

export interface LathaProviderProps {
  client: LathaClient
  basePath?: string
  loginPath?: string
  /**
   * Admin UI extensions — custom widgets, pages, dashboard widgets, settings
   * pages, field renderers, and nav links. Pass the object exported by the
   * `virtual:latha/admin-extensions` module (auto-collected from `src/admin/`)
   * or build one by hand with `defineAdminExtensions`.
   */
  extensions?: AdminExtensions
  children: ReactNode
}

export function LathaProvider({
  client,
  basePath = '/admin',
  loginPath = '/login',
  extensions,
  children,
}: LathaProviderProps) {
  // Build the registry once per extensions object, and apply field-renderer
  // overrides as a side effect of that same memo (idempotent: registering the
  // same type twice just replaces it).
  const registry = useMemo(() => {
    const reg = createExtensionRegistry(extensions)
    for (const field of reg.fields) {
      registerFieldRenderer(field.type, field.renderer)
    }
    return reg
  }, [extensions])

  const value = useMemo<LathaContextValue>(
    () => ({ client, basePath, loginPath, extensions: registry }),
    [client, basePath, loginPath, registry],
  )

  return (
    <LathaContext.Provider value={value}>
      <ExtensionsProvider extensions={registry}>{children}</ExtensionsProvider>
    </LathaContext.Provider>
  )
}

export function useLatha(): LathaContextValue {
  const ctx = useContext(LathaContext)
  if (!ctx) {
    throw new Error('useLatha must be used within a <LathaProvider>.')
  }
  return ctx
}

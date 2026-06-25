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
  type AdminExtensions,
  type ExtensionRegistry,
} from '../extensions/index.js'
import { registerFieldRenderer } from '../fields/registry.js'
import { createLathaClient, type LathaClient } from './client.js'

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
  /**
   * The RPC client. Optional — defaults to `createLathaClient()`, which talks to
   * the framework's RPC route. Pass one only to customize the transport.
   */
  client?: LathaClient
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
  // Default to the framework's RPC client; pass one only to customize transport.
  const resolved = useMemo(() => client ?? createLathaClient(), [client])

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
    () => ({ client: resolved, basePath, loginPath, extensions: registry }),
    [resolved, basePath, loginPath, registry],
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

/* -------------------------------------------------------------------------- */
/*  Permissions — client-side gating                                           */
/* -------------------------------------------------------------------------- */

const PermissionsContext = createContext<string[]>([])

/**
 * Make the current user's effective permission keys available to `useCan()`.
 * The admin shell wraps its content in this once the session resolves.
 */
export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[]
  children: ReactNode
}) {
  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  )
}

/** Client-safe permission match (mirrors `@latha/auth`'s `matchesPermission`). */
function permissionMatches(granted: string, required: string): boolean {
  if (granted === '*') return true
  if (granted === required) return true
  const [gScope, gAction] = granted.split(':')
  const [rScope, rAction] = required.split(':')
  if (gAction === undefined || rAction === undefined) return false
  return (
    (gScope === '*' || gScope === rScope) &&
    (gAction === '*' || gAction === rAction)
  )
}

/**
 * Returns a `can(permission)` predicate for gating UI off the current user's
 * permissions. This is presentation only — the server re-checks every write.
 */
export function useCan(): (required: string) => boolean {
  const permissions = useContext(PermissionsContext)
  return (required: string) => permissions.some((g) => permissionMatches(g, required))
}

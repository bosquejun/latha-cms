/**
 * Kon10Provider / useKon10 — makes the client + mount paths available to the
 * Studio components without prop-drilling.
 *
 * It also hosts the Studio extension system: any `extensions` passed in are
 * normalized into a registry, field-renderer overrides are registered, and the
 * registry is published via `<ExtensionsProvider>` so the shell, the views, and
 * every `<Slot>` can read it.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  ExtensionsProvider,
  createExtensionRegistry,
  type StudioExtensions,
  type ExtensionRegistry,
} from '../extensions/index.js'
import { registerFieldRenderer } from '../fields/registry.js'
import { createKon10Client, type Kon10Client } from './client.js'

export interface Kon10ContextValue {
  client: Kon10Client
  /** Base path the Studio is mounted under. Defaults to `/studio`. */
  basePath: string
  /** Where to send unauthenticated users. Defaults to `/login`. */
  loginPath: string
  /** The resolved extension registry (empty when no extensions are provided). */
  extensions: ExtensionRegistry
}

const Kon10Context = createContext<Kon10ContextValue | null>(null)

export interface Kon10ProviderProps {
  /**
   * The RPC client. Optional — defaults to `createKon10Client()`, which talks to
   * the framework's RPC route. Pass one only to customize the transport.
   */
  client?: Kon10Client
  basePath?: string
  loginPath?: string
  /**
   * Studio UI extensions — custom widgets, pages, dashboard widgets, settings
   * pages, field renderers, and nav links. Pass the object exported by the
   * `virtual:kon10/studio-extensions` module (auto-collected from `src/studio/`)
   * or build one by hand with `defineStudioExtensions`.
   */
  extensions?: StudioExtensions
  children: ReactNode
}

export function Kon10Provider({
  client,
  basePath = '/studio',
  loginPath = '/login',
  extensions,
  children,
}: Kon10ProviderProps) {
  // Default to the framework's RPC client; pass one only to customize transport.
  const resolved = useMemo(() => client ?? createKon10Client(), [client])

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

  const value = useMemo<Kon10ContextValue>(
    () => ({ client: resolved, basePath, loginPath, extensions: registry }),
    [resolved, basePath, loginPath, registry],
  )

  return (
    <Kon10Context.Provider value={value}>
      <ExtensionsProvider extensions={registry}>{children}</ExtensionsProvider>
    </Kon10Context.Provider>
  )
}

export function useKon10(): Kon10ContextValue {
  const ctx = useContext(Kon10Context)
  if (!ctx) {
    throw new Error('useKon10 must be used within a <Kon10Provider>.')
  }
  return ctx
}

/* -------------------------------------------------------------------------- */
/*  Navigation — router-agnostic client-side navigation for extensions        */
/* -------------------------------------------------------------------------- */

type StudioNavigate = (href: string) => void

const StudioNavigateContext = createContext<StudioNavigate | null>(null)

/**
 * Provide client-side navigation to Studio extensions so extension pages
 * stay router-agnostic while the host app's router does the actual
 * navigating.
 */
export function StudioNavigateProvider({
  navigate,
  children,
}: {
  navigate: StudioNavigate
  children: ReactNode
}) {
  return (
    <StudioNavigateContext.Provider value={navigate}>
      {children}
    </StudioNavigateContext.Provider>
  )
}

/**
 * Navigate to a Studio href (e.g. `${basePath}/settings/roles/123`).
 * Client-side when a provider bridged the router; falls back to a full
 * document navigation otherwise, so extension code works in any host.
 */
export function useStudioNavigate(): StudioNavigate {
  const navigate = useContext(StudioNavigateContext)
  return navigate ?? ((href) => window.location.assign(href))
}

/* -------------------------------------------------------------------------- */
/*  Permissions — client-side gating                                           */
/* -------------------------------------------------------------------------- */

const PermissionsContext = createContext<string[]>([])

/**
 * Make the current user's effective permission keys available to `useCan()`.
 * The Studio shell wraps its content in this once the session resolves.
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

/** Client-safe permission match (mirrors `@kon10/auth`'s `matchesPermission`). */
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

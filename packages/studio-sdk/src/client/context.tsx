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

/**
 * Presentation-only branding for the login screen and Studio shell. These are
 * React props (the `logo` is a `ReactNode`), not persisted/validated config, so
 * this is a plain interface rather than a Zod schema — the same contract as the
 * rest of {@link Kon10ProviderProps}.
 */
export interface Kon10Branding {
  /**
   * Product / brand name shown as the wordmark in the Studio shell and on the
   * login screen. Defaults to `Kon10`.
   */
  appName?: string
  /**
   * Brand logo rendered as the mark on the login screen and in the Studio
   * shell. A **string** is treated as an image URL/path (as it arrives from
   * `kon10.config`'s serializable `studio.branding.logo`); a **React element**
   * (an inline SVG component, a custom `<img>`, …) is rendered as-is. It is
   * sized by its container. Falls back to the default mark when omitted.
   */
  logo?: ReactNode
  /** Login-screen heading. Defaults to `Welcome back`. */
  loginTitle?: string
  /**
   * Login-screen subheading under the title. Defaults to
   * `Sign in to continue to <appName>`.
   */
  loginSubtitle?: string
  /**
   * Sign-up destination (a URL/path). When set, the login screen shows a
   * "Sign up" action linking here; omit it and no sign-up button renders.
   */
  signUpUrl?: string
  /**
   * First-run setup heading, shown once on an install with no users.
   * Defaults to `Welcome to <appName>`.
   */
  setupTitle?: string
  /**
   * First-run setup subheading. Defaults to
   * `Create the admin account to get started.`
   */
  setupSubtitle?: string
  /**
   * Headline shown on the login screen's branded side panel (the large ink
   * panel beside the form on `lg+`). Keep it short. Has a Kon10 default.
   */
  tagline?: string
  /** Supporting line under {@link Kon10Branding.tagline}. Has a Kon10 default. */
  taglineSubtitle?: string
}

/** Branding after the provider has applied defaults — `appName` is guaranteed. */
export type ResolvedBranding = Kon10Branding & { appName: string }

/**
 * A one-time, dismissible transparency notice shown in the Studio on first
 * sign-in (e.g. disclosing operational telemetry). Informational only — it
 * never gates telemetry. Mirrors `StudioTelemetryNoticeConfig` in `kon10`
 * (all serializable), and arrives from `kon10.config`'s `studio.telemetryNotice`.
 */
export interface Kon10TelemetryNotice {
  /** Show the notice. Default `false`. */
  enabled?: boolean
  /**
   * First-login dialog behavior:
   * - `'notice'` (default) — disclosure with an acknowledge button.
   * - `'opt-out'` — on by default; Turn off (deny) / Keep anonymous (allow).
   * - `'opt-in'` — off until Allow / No thanks.
   */
  mode?: 'notice' | 'opt-out' | 'opt-in'
  /** Dialog title. Has a sensible default. */
  title?: string
  /** Dialog body. Has a sensible default. */
  message?: string
  /** Optional policy link, shown as "Learn more". */
  policyUrl?: string
  /** Optional in-Studio path to the telemetry opt-out settings; shows a "Manage" button. */
  manageUrl?: string
}

export interface Kon10ContextValue {
  client: Kon10Client
  /** Base path the Studio is mounted under. Defaults to `/studio`. */
  basePath: string
  /** Where to send unauthenticated users. Defaults to `/login`. */
  loginPath: string
  /** Where first-run setup is mounted. Defaults to `/setup`. */
  setupPath: string
  /** The resolved extension registry (empty when no extensions are provided). */
  extensions: ExtensionRegistry
  /** Resolved branding for the login screen and Studio shell. */
  branding: ResolvedBranding
  /** Studio transparency notice (disabled by default). */
  telemetryNotice: Kon10TelemetryNotice
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
   * Where the first-run setup screen is mounted. Keep this pointed at wherever
   * `kon10Start({ setupPath })` mounts it; the login screen redirects here when
   * the install has no users yet.
   */
  setupPath?: string
  /**
   * Studio UI extensions — custom widgets, pages, dashboard widgets, settings
   * pages, field renderers, and nav links. Pass the object exported by the
   * `virtual:kon10/studio-extensions` module (auto-collected from `src/studio/`)
   * or build one by hand with `defineStudioExtensions`.
   */
  extensions?: StudioExtensions
  /**
   * Branding for the login screen and Studio shell — app name, logo, and the
   * login copy. Every field is optional and falls back to Kon10 defaults, so
   * apps can rebrand the whole Studio from this one place. See {@link Kon10Branding}.
   */
  branding?: Kon10Branding
  /**
   * One-time transparency notice shown in the Studio (disabled unless
   * `enabled`). Typically wired from `studioConfig.telemetryNotice`
   * (`virtual:kon10/studio-config`). See {@link Kon10TelemetryNotice}.
   */
  telemetryNotice?: Kon10TelemetryNotice
  children: ReactNode
}

export function Kon10Provider({
  client,
  basePath = '/studio',
  loginPath = '/login',
  setupPath = '/setup',
  extensions,
  branding,
  telemetryNotice,
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

  // Resolve branding once, guaranteeing `appName` so consumers never re-default.
  const resolvedBranding = useMemo<ResolvedBranding>(
    () => ({ appName: 'Kon10', ...branding }),
    [branding],
  )

  // Stable identity when unset so consumers' effects don't re-fire each render.
  const resolvedNotice = useMemo<Kon10TelemetryNotice>(
    () => telemetryNotice ?? {},
    [telemetryNotice],
  )

  const value = useMemo<Kon10ContextValue>(
    () => ({
      client: resolved,
      basePath,
      loginPath,
      setupPath,
      extensions: registry,
      branding: resolvedBranding,
      telemetryNotice: resolvedNotice,
    }),
    [resolved, basePath, loginPath, setupPath, registry, resolvedBranding, resolvedNotice],
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

/**
 * Telemetry consent — the per-user choice for anonymous installation usage
 * monitoring.
 *
 * The Studio records consent per-user in `localStorage` and mirrors it to a
 * cookie so the server can honor it. Nothing here collects anything — this is
 * only the control surface.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type TelemetryConsent = 'granted' | 'denied' | 'unset'

const CONSENT_PREFIX = 'kon10-telemetry-consent:'
// Cookies the server reads (per browser). Kept short + non-identifying.
const CONSENT_COOKIE = 'kon10_tm_consent'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* no storage — ignore */
  }
}

function writeCookie(name: string, value: string): void {
  try {
    document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
  } catch {
    /* server / no document — ignore */
  }
}

/** Load one user's preferences and replace the server-facing browser cookies. */
export function syncTelemetryPreferences(userId: string): {
  status: TelemetryConsent
  anonymous: boolean
} {
  const status = getTelemetryConsent(userId)
  writeCookie(CONSENT_COOKIE, status)
  return { status, anonymous: true }
}

/** Read the stored consent for a user. Safe on the server / without storage. */
export function getTelemetryConsent(userId: string): TelemetryConsent {
  const value = readLocal(`${CONSENT_PREFIX}${userId}`)
  return value === 'granted' || value === 'denied' ? value : 'unset'
}

/**
 * @deprecated Kon10 telemetry is always account-unlinked. Kept temporarily so
 * existing custom Studio code remains source-compatible.
 */
export function getTelemetryAnonymous(_userId: string): boolean {
  return true
}

export interface TelemetryConsentValue {
  /** Current consent. `'unset'` until the user chooses. */
  status: TelemetryConsent
  /** @deprecated Always `true`; account identifiers are never attached. */
  anonymous: boolean
  /** Record consent (allow monitoring). */
  grant(): void
  /** Record refusal (do not monitor). */
  deny(): void
  /** @deprecated No-op; telemetry is always account-unlinked. */
  setAnonymous(anonymous: boolean): void
}

const TelemetryConsentContext = createContext<TelemetryConsentValue | null>(null)

/**
 * Hold the current user's telemetry consent. The Studio mounts this once the
 * session resolves (keyed by user id); loading a user replaces the shared
 * server-facing cookie so another account's choice cannot leak across login.
 */
export function TelemetryConsentProvider({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  const [status, setStatus] = useState<TelemetryConsent>('unset')

  // localStorage/cookies are client-only — read after mount to stay SSR-safe.
  useEffect(() => {
    const preferences = syncTelemetryPreferences(userId)
    setStatus(preferences.status)
  }, [userId])

  const persistStatus = useCallback(
    (next: Exclude<TelemetryConsent, 'unset'>) => {
      writeLocal(`${CONSENT_PREFIX}${userId}`, next)
      writeCookie(CONSENT_COOKIE, next)
      setStatus(next)
    },
    [userId],
  )

  const grant = useCallback(() => persistStatus('granted'), [persistStatus])
  const deny = useCallback(() => persistStatus('denied'), [persistStatus])

  const setAnonymous = useCallback((_next: boolean) => {}, [])

  const value = useMemo<TelemetryConsentValue>(
    () => ({ status, anonymous: true, grant, deny, setAnonymous }),
    [status, grant, deny, setAnonymous],
  )

  return (
    <TelemetryConsentContext.Provider value={value}>
      {children}
    </TelemetryConsentContext.Provider>
  )
}

/**
 * Read or change the current user's telemetry choice. `status === 'granted'`
 * gates opt-in monitoring. Returns inert defaults outside a
 * {@link TelemetryConsentProvider}.
 */
export function useTelemetryConsent(): TelemetryConsentValue {
  const ctx = useContext(TelemetryConsentContext)
  return (
    ctx ?? {
      status: 'unset',
      anonymous: true,
      grant: () => {},
      deny: () => {},
      setAnonymous: () => {},
    }
  )
}

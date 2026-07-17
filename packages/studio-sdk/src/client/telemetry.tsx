/**
 * Telemetry consent — the opt-in state for anonymous tracking.
 *
 * Kon10 collects nothing itself; this is the consent *primitive*. The Studio
 * records a per-user choice (in `localStorage`, like a cookie banner) and
 * exposes it via `useTelemetryConsent()`, so an operator can gate their own
 * anonymous analytics on `status === 'granted'`. Opt-in by default: until the
 * user chooses, `status` is `'unset'` and nothing should be tracked.
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

/** Read the stored consent for a user. Safe on the server / without storage. */
export function getTelemetryConsent(userId: string): TelemetryConsent {
  try {
    const value = localStorage.getItem(`${CONSENT_PREFIX}${userId}`)
    return value === 'granted' || value === 'denied' ? value : 'unset'
  } catch {
    return 'unset'
  }
}

function storeConsent(userId: string, value: Exclude<TelemetryConsent, 'unset'>) {
  try {
    localStorage.setItem(`${CONSENT_PREFIX}${userId}`, value)
  } catch {
    // Best-effort — no storage means the choice isn't remembered across loads.
  }
}

export interface TelemetryConsentValue {
  /** Current consent for anonymous tracking. `'unset'` until the user chooses. */
  status: TelemetryConsent
  /** Record consent (allow anonymous tracking). */
  grant(): void
  /** Record refusal (do not track). */
  deny(): void
}

const TelemetryConsentContext = createContext<TelemetryConsentValue | null>(null)

/**
 * Hold the current user's telemetry-consent choice. The Studio mounts this once
 * the session resolves (keyed by the user id); consumers read it with
 * `useTelemetryConsent()`.
 */
export function TelemetryConsentProvider({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  const [status, setStatus] = useState<TelemetryConsent>('unset')

  // localStorage is client-only — read after mount to stay SSR-safe.
  useEffect(() => {
    setStatus(getTelemetryConsent(userId))
  }, [userId])

  const grant = useCallback(() => {
    storeConsent(userId, 'granted')
    setStatus('granted')
  }, [userId])
  const deny = useCallback(() => {
    storeConsent(userId, 'denied')
    setStatus('denied')
  }, [userId])

  const value = useMemo<TelemetryConsentValue>(
    () => ({ status, grant, deny }),
    [status, grant, deny],
  )

  return (
    <TelemetryConsentContext.Provider value={value}>
      {children}
    </TelemetryConsentContext.Provider>
  )
}

/**
 * Read / change the current user's consent for anonymous tracking. Gate your
 * own analytics on `status === 'granted'`; call `grant()`/`deny()` from a
 * settings toggle to let users change their mind. Returns inert defaults when
 * used outside a {@link TelemetryConsentProvider}.
 */
export function useTelemetryConsent(): TelemetryConsentValue {
  const ctx = useContext(TelemetryConsentContext)
  return ctx ?? { status: 'unset', grant: () => {}, deny: () => {} }
}

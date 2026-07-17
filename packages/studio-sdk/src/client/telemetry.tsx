/**
 * Telemetry consent — the per-user opt-out for monitoring, plus an anonymity
 * preference (stay anonymous vs. attach your email).
 *
 * The Studio records both choices per-user in `localStorage` (for the UI) and
 * mirrors them to cookies (so the server can honor them when it emits product
 * events). Nothing here collects anything — this is the control surface. Read it
 * with `useTelemetryConsent()`; render the `<TelemetrySettings>` page for the
 * toggles, or set it from the first-login dialog.
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
const ANON_PREFIX = 'kon10-telemetry-anon:'
// Cookies the server reads (per browser). Kept short + non-identifying.
const CONSENT_COOKIE = 'kon10_tm_consent'
const ANON_COOKIE = 'kon10_tm_anon'
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

/** Read the stored consent for a user. Safe on the server / without storage. */
export function getTelemetryConsent(userId: string): TelemetryConsent {
  const value = readLocal(`${CONSENT_PREFIX}${userId}`)
  return value === 'granted' || value === 'denied' ? value : 'unset'
}

/** Read the stored anonymity preference. Defaults to `true` (anonymous). */
export function getTelemetryAnonymous(userId: string): boolean {
  return readLocal(`${ANON_PREFIX}${userId}`) !== '0'
}

export interface TelemetryConsentValue {
  /** Current consent. `'unset'` until the user chooses. */
  status: TelemetryConsent
  /** Whether events stay anonymous (no email attached). Defaults to `true`. */
  anonymous: boolean
  /** Record consent (allow monitoring). */
  grant(): void
  /** Record refusal (do not monitor). */
  deny(): void
  /** Toggle whether the user's email is attached (`false`) or not (`true`). */
  setAnonymous(anonymous: boolean): void
}

const TelemetryConsentContext = createContext<TelemetryConsentValue | null>(null)

/**
 * Hold the current user's telemetry choices (consent + anonymity). The Studio
 * mounts this once the session resolves (keyed by the user id); consumers read
 * it with `useTelemetryConsent()`.
 */
export function TelemetryConsentProvider({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  const [status, setStatus] = useState<TelemetryConsent>('unset')
  const [anonymous, setAnonymousState] = useState(true)

  // localStorage/cookies are client-only — read after mount to stay SSR-safe.
  useEffect(() => {
    setStatus(getTelemetryConsent(userId))
    setAnonymousState(getTelemetryAnonymous(userId))
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

  const setAnonymous = useCallback(
    (next: boolean) => {
      writeLocal(`${ANON_PREFIX}${userId}`, next ? '1' : '0')
      writeCookie(ANON_COOKIE, next ? '1' : '0')
      setAnonymousState(next)
    },
    [userId],
  )

  const value = useMemo<TelemetryConsentValue>(
    () => ({ status, anonymous, grant, deny, setAnonymous }),
    [status, anonymous, grant, deny, setAnonymous],
  )

  return (
    <TelemetryConsentContext.Provider value={value}>
      {children}
    </TelemetryConsentContext.Provider>
  )
}

/**
 * Read / change the current user's telemetry choices. `status === 'granted'`
 * gates monitoring; `anonymous` controls whether their email is attached. Gate
 * your own analytics on these. Returns inert defaults outside a
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

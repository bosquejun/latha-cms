/**
 * LathaProvider / useLatha — makes the client + mount paths available to the
 * admin components without prop-drilling.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createLathaClient, type LathaClient } from './client.js'

export interface LathaContextValue {
  client: LathaClient
  /** Base path the admin is mounted under. Defaults to `/admin`. */
  basePath: string
  /** Where to send unauthenticated users. Defaults to `/login`. */
  loginPath: string
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
  children: ReactNode
}

export function LathaProvider({
  client,
  basePath = '/admin',
  loginPath = '/login',
  children,
}: LathaProviderProps) {
  const resolved = useMemo(() => client ?? createLathaClient(), [client])
  return (
    <LathaContext.Provider value={{ client: resolved, basePath, loginPath }}>
      {children}
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

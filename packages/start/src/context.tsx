/**
 * LathaProvider / useLatha — makes the client + mount paths available to the
 * admin components without prop-drilling.
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { LathaClient } from './client.js'

export interface LathaContextValue {
  client: LathaClient
  /** Base path the admin is mounted under. Defaults to `/admin`. */
  basePath: string
  /** Where to send unauthenticated users. Defaults to `/login`. */
  loginPath: string
}

const LathaContext = createContext<LathaContextValue | null>(null)

export interface LathaProviderProps {
  client: LathaClient
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
  return (
    <LathaContext.Provider value={{ client, basePath, loginPath }}>
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

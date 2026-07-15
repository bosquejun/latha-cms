/**
 * React context carrying a `DeliveryClient`, so the data hooks can be called
 * without threading the client through every component.
 */
import { createContext, useContext, type ReactNode } from 'react'
import type { DeliveryClient } from '@kon10/client'

const ClientContext = createContext<DeliveryClient | null>(null)

export interface Kon10ProviderProps {
  client: DeliveryClient
  children: ReactNode
}

/** Provide a delivery client to everything under it. */
export function Kon10Provider({ client, children }: Kon10ProviderProps) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
}

/** Read the delivery client from context. Throws when used outside a provider. */
export function useDeliveryClient(): DeliveryClient {
  const client = useContext(ClientContext)
  if (!client) {
    throw new Error('useDeliveryClient must be used within a <Kon10Provider>.')
  }
  return client
}

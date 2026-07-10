/**
 * React context that makes the extension registry available to the shell, the
 * views, and every `<Slot>` without prop-drilling. When no provider is present
 * the hooks fall back to an empty registry, so slots are inert by default.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  createExtensionRegistry,
  EMPTY_REGISTRY,
  type ExtensionRegistry,
} from './registry.js'
import type { StudioExtensions } from './types.js'
import type { StudioZone } from './zones.js'
import type { WidgetExtension } from './types.js'

const ExtensionsContext = createContext<ExtensionRegistry>(EMPTY_REGISTRY)

export interface ExtensionsProviderProps {
  /** Raw extensions to build a registry from, or a prebuilt registry. */
  extensions?: StudioExtensions | ExtensionRegistry
  children: ReactNode
}

function isRegistry(
  value: StudioExtensions | ExtensionRegistry,
): value is ExtensionRegistry {
  return typeof (value as ExtensionRegistry).widgetsForZone === 'function'
}

export function ExtensionsProvider({
  extensions,
  children,
}: ExtensionsProviderProps) {
  const registry = useMemo<ExtensionRegistry>(() => {
    if (!extensions) return EMPTY_REGISTRY
    return isRegistry(extensions)
      ? extensions
      : createExtensionRegistry(extensions)
  }, [extensions])
  return (
    <ExtensionsContext.Provider value={registry}>
      {children}
    </ExtensionsContext.Provider>
  )
}

/** The active extension registry (empty when no provider is mounted). */
export function useExtensions(): ExtensionRegistry {
  return useContext(ExtensionsContext)
}

/** The widgets registered for a single zone, in render order. */
export function useZoneWidgets(zone: StudioZone): WidgetExtension[] {
  return useExtensions().widgetsForZone(zone)
}

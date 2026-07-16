/// <reference types="vite/client" />
/// <reference types="@kon10/start/virtual" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Kon10Provider } from '@kon10/start'
import { studioExtensions } from 'virtual:kon10/studio-extensions'
import { studioConfig } from 'virtual:kon10/studio-config'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Kon10 App' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Kon10Provider
        basePath="/studio"
        loginPath="/login"
        branding={studioConfig.branding}
        extensions={studioExtensions}
      >
        <Outlet />
      </Kon10Provider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

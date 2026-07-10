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
import { mergeExtensions } from '@kon10/admin-sdk'
import { adminExtensions as baseExtensions } from 'virtual:kon10/admin-extensions'
import { FileTextIcon, FileStackIcon, FolderTreeIcon } from 'lucide-animated'
import appCss from '../styles.css?url'

// Content-module entity kinds → animated sidebar icons. Lives here (not in
// admin-sdk or start) because icon choices are an app-level concern: this app
// uses @kon10/content and picks the icons it wants for each kind.
const adminExtensions = mergeExtensions([
  baseExtensions,
  { kindIcons: { collection: FileTextIcon, document: FileStackIcon, taxonomy: FolderTreeIcon } },
])

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Kon10 Playground' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Kon10Provider basePath="/admin" loginPath="/login" extensions={adminExtensions}>
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

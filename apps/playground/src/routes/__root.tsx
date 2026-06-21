/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'LathaCMS Playground' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style>{baseStyles}</style>
      </head>
      <body>
        <div className="shell">
          <header className="topbar">
            <strong>LathaCMS</strong>
            <span className="muted">playground · phase 1</span>
          </header>
          <main>{children}</main>
        </div>
        <Scripts />
      </body>
    </html>
  )
}

const baseStyles = `
  :root { color-scheme: light dark; --fg: #1a1a1a; --muted: #777; --line: #e5e5e5; --accent: #2563eb; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; color: var(--fg); }
  .shell { max-width: 760px; margin: 0 auto; padding: 0 20px 64px; }
  .topbar { display: flex; align-items: baseline; gap: 10px; padding: 20px 0; border-bottom: 1px solid var(--line); margin-bottom: 28px; }
  .muted { color: var(--muted); font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 18px; }
  form { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
  input, select { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font: inherit; }
  input[type=text] { flex: 1; min-width: 200px; }
  button { padding: 8px 14px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; font: inherit; cursor: pointer; }
  button.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
  ul.posts { list-style: none; padding: 0; margin: 0; }
  ul.posts li { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); }
  .pill { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #eee; color: #555; }
  .grow { flex: 1; }
  .empty { color: var(--muted); padding: 24px 0; }
`

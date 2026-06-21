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
  h1 { font-size: 22px; margin: 0; }
  .pagehead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; }
  .link { color: var(--accent); text-decoration: none; font-size: 14px; }
  .link:hover { text-decoration: underline; }
  code { background: #f2f2f2; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
  form { display: flex; gap: 8px; margin: 16px 0 24px; flex-wrap: wrap; }
  form.stack { flex-direction: column; align-items: stretch; max-width: 360px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field span { font-size: 13px; color: var(--muted); }
  .ok { color: #16a34a; font-size: 13px; margin-left: 8px; }
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

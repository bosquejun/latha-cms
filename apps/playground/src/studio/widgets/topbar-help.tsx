/**
 * Example widget — a help link pinned to the start of the Studio topbar.
 *
 * A file under `src/studio/widgets/` becomes a widget when it exports a default
 * component plus a `config` declaring its zone(s). The `kon10Start()` Vite
 * plugin auto-collects it; no manual registration.
 */

import { defineWidgetConfig, type WidgetContext } from '@kon10/start'
import { LifeBuoy } from 'lucide-react'

export const config = defineWidgetConfig({ zone: 'shell.topbar.start' })

export default function TopbarHelp(_props: WidgetContext) {
  return (
    <a
      href="https://github.com/bosquejun/latha-cms"
      target="_blank"
      rel="noreferrer"
      aria-label="Help"
      className="flex min-h-tap min-w-tap touch-manipulation items-center justify-center gap-tight rounded-md px-inline py-stack text-small text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <LifeBuoy className="size-4" />
      {/* Icon-only on phones to keep the topbar uncluttered. */}
      <span className="max-sm:hidden">Help</span>
    </a>
  )
}

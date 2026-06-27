/**
 * Example widget — a help link pinned to the start of the admin topbar.
 *
 * A file under `src/admin/widgets/` becomes a widget when it exports a default
 * component plus a `config` declaring its zone(s). The `lathaStart()` Vite
 * plugin auto-collects it; no manual registration.
 */

import { defineWidgetConfig, type WidgetContext } from '@latha/start'
import { LifeBuoy } from 'lucide-react'

export const config = defineWidgetConfig({ zone: 'shell.topbar.start' })

export default function TopbarHelp(_props: WidgetContext) {
  return (
    <a
      href="https://github.com/bosquejun/latha-cms"
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-tight rounded-md px-inline py-stack text-small text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <LifeBuoy className="size-4" />
      Help
    </a>
  )
}

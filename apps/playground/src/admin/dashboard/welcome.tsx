/**
 * Example dashboard widget — a card dropped into the dashboard grid.
 *
 * Files under `src/admin/dashboard/` render alongside the auto-generated stat
 * cards. `config.span` controls how many of the 4 grid columns it occupies.
 */

import { defineDashboardWidgetConfig, type WidgetContext } from '@kon10/start'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@kon10/ui'
import { Sparkles } from 'lucide-react'

export const config = defineDashboardWidgetConfig({ span: 2 })

export default function Welcome(_props: WidgetContext) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-inline">
          <Sparkles className="size-4 text-muted-foreground" />
          <CardTitle>Welcome to your admin</CardTitle>
        </div>
        <CardDescription>This card is a custom dashboard widget.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 text-small text-muted-foreground">
        Drop a file in <code>src/admin/dashboard/</code> and it shows up here —
        no registration, no route wiring.
      </CardContent>
    </Card>
  )
}

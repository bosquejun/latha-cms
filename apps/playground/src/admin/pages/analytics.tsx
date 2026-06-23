/**
 * Example custom page — a full admin route with its own sidebar entry.
 *
 * Files under `src/admin/pages/` mount at `<adminBase>/<config.path>` and add a
 * sidebar link under `config.group`. The component receives the splat `params`
 * for anything after its mount path.
 */

import { definePageConfig, type PageComponentProps } from '@latha/start'
import { PageHeader } from '@latha/admin-sdk'
import { Card, CardHeader, CardTitle, CardContent } from '@latha/ui'
import { BarChart3 } from 'lucide-react'

export const config = definePageConfig({
  path: 'analytics',
  label: 'Analytics',
  icon: BarChart3,
  // No `group` → renders ungrouped at the top of the sidebar (no heading).
})

export default function Analytics({ params }: PageComponentProps) {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="A custom page mounted at /admin/analytics."
      />
      <Card>
        <CardHeader>
          <CardTitle>Custom page</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-small text-muted-foreground">
          This whole view is rendered by a dev-owned component. Sub-path
          segments arrive as <code>params</code>:{' '}
          <code>[{params.map((p) => `"${p}"`).join(', ')}]</code>.
        </CardContent>
      </Card>
    </>
  )
}

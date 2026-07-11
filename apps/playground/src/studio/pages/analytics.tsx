/**
 * Example custom page — a full Studio route with its own nav entry.
 *
 * Files under `src/studio/pages/` mount at `<studioBase>/<config.path>` and add
 * a nav entry: grouped pages share a top-level tab (listed in its section
 * rail), ungrouped ones become their own tab. The component receives the
 * splat `params` for anything after its mount path.
 */

import { definePageConfig, type PageComponentProps } from '@kon10/start'
import { PageHeader, PageLayout } from '@kon10/studio-sdk'
import { Card, CardHeader, CardTitle, CardContent } from '@kon10/ui'
import { BarChart3 } from 'lucide-react'

export const config = definePageConfig({
  path: 'analytics',
  label: 'Analytics',
  icon: BarChart3,
  // No `group` → a top-level tab of its own. `order` places it: the Content
  // section sits at 10, so 100 drops Analytics after it in the tab strip.
  // (Drop `order` and an ungrouped entry defaults to the front.)
  order: 100,
})

export default function Analytics({ params }: PageComponentProps) {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="A custom page mounted at /studio/analytics."
      />
      <PageLayout>
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
      </PageLayout>
    </>
  )
}

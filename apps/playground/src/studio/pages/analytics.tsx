/**
 * Example custom page — a full Studio route with its own sidebar entry.
 *
 * Files under `src/studio/pages/` mount at `<studioBase>/<config.path>` and add a
 * sidebar link under `config.group`. The component receives the splat `params`
 * for anything after its mount path.
 */

import { definePageConfig, type PageComponentProps } from '@kon10/start'
import { PageHeader, PageLayout } from '@kon10/studio-sdk'
import { Card, CardHeader, CardTitle, CardContent } from '@kon10/ui'
import { BarChart3 } from 'lucide-react'

export const config = definePageConfig({
  path: 'analytics',
  label: 'Analytics',
  icon: BarChart3,
  // No `group` → a free-floating sidebar entry. `order` places it: the Content
  // group sits at 10, so 100 drops Analytics below it. (Drop `order` and an
  // ungrouped item defaults to the top.)
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

/**
 * Example settings page — appears under the sidebar "Settings" group and on the
 * settings index at `/admin/settings`.
 *
 * Files under `src/admin/settings/` mount at `<adminBase>/settings/<path>`.
 */

import { defineSettingsConfig, type PageComponentProps } from '@latha/start'
import { PageHeader } from '@latha/admin-sdk'
import { Card, CardHeader, CardTitle, CardContent } from '@latha/ui'
import { Palette } from 'lucide-react'

export const config = defineSettingsConfig({
  path: 'branding',
  label: 'Branding',
  description: 'Logo, colors, and admin appearance.',
  icon: Palette,
})

export default function Branding(_props: PageComponentProps) {
  return (
    <>
      <PageHeader title="Branding" description="A custom settings page." />
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-small text-muted-foreground">
          Settings pages are just custom pages namespaced under{' '}
          <code>/settings</code>, with an auto-generated index that lists them.
        </CardContent>
      </Card>
    </>
  )
}

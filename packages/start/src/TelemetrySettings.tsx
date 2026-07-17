/**
 * TelemetrySettings — a drop-in Studio settings page wrapping the shared
 * {@link TelemetryToggles}. Wire it into a settings page:
 *
 *   // src/studio/settings/telemetry.tsx
 *   import { TelemetrySettings, defineSettingsConfig } from '@kon10/start'
 *   export const config = defineSettingsConfig({ path: 'telemetry', label: 'Telemetry' })
 *   export default TelemetrySettings
 *
 * The switches control the *user's* own monitoring; the operator can still
 * disable telemetry deployment-wide via `KON10_DISABLE_TELEMETRY` / `DO_NOT_TRACK`.
 */

import { PageHeader, useKon10 } from '@kon10/studio-sdk'
import { Card } from '@kon10/ui'
import { TelemetryToggles } from './TelemetryToggles.js'

export function TelemetrySettings() {
  const { branding } = useKon10()

  return (
    <>
      <PageHeader
        title="Telemetry"
        description={`Choose what usage data you share with ${branding.appName}, and whether it stays anonymous. We never see the content you manage.`}
      />
      <Card className="p-0">
        <TelemetryToggles />
      </Card>
    </>
  )
}

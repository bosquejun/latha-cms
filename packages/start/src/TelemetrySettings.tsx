/**
 * TelemetrySettings — a drop-in Studio settings page with the per-user opt-out
 * toggles. Wire it into a settings page:
 *
 *   // src/studio/settings/telemetry.tsx
 *   import { TelemetrySettings, defineSettingsConfig } from '@kon10/start'
 *   export const config = defineSettingsConfig({ path: 'telemetry', label: 'Telemetry' })
 *   export default TelemetrySettings
 *
 * The switches drive `useTelemetryConsent()`, which persists per-user and mirrors
 * to cookies so the server honors the choice. These control the *user's* own
 * monitoring; the operator can still disable telemetry deployment-wide via
 * `KON10_DISABLE_TELEMETRY` / `DO_NOT_TRACK`.
 */

import { PageHeader, useKon10, useTelemetryConsent } from '@kon10/studio-sdk'
import { Card, Switch } from '@kon10/ui'

function Row({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-group p-card">
      <div className="flex flex-col gap-tight">
        <span className="text-small font-medium">{title}</span>
        <span className="text-caption text-muted-foreground">{description}</span>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.currentTarget.checked)}
        aria-label={title}
      />
    </div>
  )
}

export function TelemetrySettings() {
  const { branding } = useKon10()
  const { status, anonymous, grant, deny, setAnonymous } = useTelemetryConsent()
  // Telemetry is opt-out: on unless explicitly denied. So `unset` reads as on —
  // matching what the server actually does when no consent cookie is present.
  const enabled = status !== 'denied'

  return (
    <>
      <PageHeader
        title="Telemetry"
        description={`Control how ${branding.appName} monitors your Studio usage. Anonymous, and never your content.`}
      />
      <Card className="divide-y divide-border p-0">
        <Row
          title="Usage monitoring"
          description="Share anonymous product and technical usage to help improve the Studio."
          checked={enabled}
          onCheckedChange={(next) => (next ? grant() : deny())}
        />
        <Row
          title="Stay anonymous"
          description="Keep events anonymous. Turn off to attach your email so usage is tied to your account."
          checked={anonymous}
          disabled={!enabled}
          onCheckedChange={setAnonymous}
        />
      </Card>
    </>
  )
}

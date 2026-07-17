/**
 * TelemetryToggles — the two per-user telemetry switches (Usage monitoring,
 * Stay anonymous), shared by the Settings page and the first-login dialog. Each
 * switch drives `useTelemetryConsent()` live, so flipping it here takes effect
 * immediately (and mirrors to the cookies the server reads).
 */

import { useTelemetryConsent } from '@kon10/studio-sdk'
import { Switch } from '@kon10/ui'

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
    <div className="flex items-start justify-between gap-group px-card py-group">
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

export function TelemetryToggles() {
  const { status, anonymous, grant, deny, setAnonymous } = useTelemetryConsent()
  // Opt-out: on unless explicitly denied, so `unset` reads as on — matching the
  // server default when no consent cookie is present.
  const enabled = status !== 'denied'

  return (
    <div className="divide-y divide-border">
      <Row
        title="Share usage data"
        description="Send usage data to help make the Studio better. On by default."
        checked={enabled}
        onCheckedChange={(next) => (next ? grant() : deny())}
      />
      <Row
        title="Link to your account"
        description="Your usage is linked to your account so we can see how it is used. Turn this off to share it anonymously instead."
        checked={!anonymous}
        disabled={!enabled}
        onCheckedChange={(next) => setAnonymous(!next)}
      />
    </div>
  )
}

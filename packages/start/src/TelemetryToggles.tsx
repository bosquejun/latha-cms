/**
 * The per-user usage-data control shared by Settings and the first-login dialog.
 * It drives `useTelemetryConsent()` live and mirrors the choice to the cookie
 * read by the server.
 */

import { useTelemetryConsent } from '@kon10/studio-sdk'
import { Switch } from '@kon10/ui'

function Row({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
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
        onChange={(e) => onCheckedChange(e.currentTarget.checked)}
        aria-label={title}
      />
    </div>
  )
}

export function TelemetryToggles() {
  const { status, grant, deny } = useTelemetryConsent()
  // Opt-out: on unless explicitly denied, so `unset` reads as on — matching the
  // server default when no consent cookie is present.
  const enabled = status !== 'denied'

  return (
    <div className="divide-y divide-border">
      <Row
        title="Share Studio actions"
        description="Send allow-listed action names to help improve the Studio. No account identity or managed content is sent."
        checked={enabled}
        onCheckedChange={(next) => (next ? grant() : deny())}
      />
    </div>
  )
}

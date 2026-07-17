/**
 * TelemetryNotice — a one-time dialog shown in the Studio on a user's first
 * sign-in when `studio.telemetryNotice.enabled` is set. Two modes:
 *
 *  - `'notice'` (default): a disclosure with a single "Got it" acknowledge.
 *  - `'opt-in'`: asks consent for anonymous tracking (Allow / No thanks). The
 *    choice is recorded via `useTelemetryConsent()`; Kon10 tracks nothing
 *    itself, so gate your own analytics on a `'granted'` consent.
 *
 * The "seen" / consent state is stored per-user in `localStorage`, so this shows
 * once per user per browser — no schema or RPC changes.
 */

import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kon10/ui'
import { useKon10, useTelemetryConsent } from '@kon10/studio-sdk'

const ACK_PREFIX = 'kon10-telemetry-ack:'

const DEFAULT_NOTICE_TITLE = 'A note on telemetry'
const DEFAULT_NOTICE_MESSAGE =
  'This Studio sends operational telemetry — performance and error traces of ' +
  'Studio actions — to the operator’s monitoring backend to help keep it ' +
  'reliable. It is not used for advertising, and the content you manage is not collected.'

const DEFAULT_OPTIN_MESSAGE =
  'Allow anonymous usage analytics to help improve the product. No content you ' +
  'manage and no personal data is collected, and you can change this anytime.'

export function TelemetryNotice({ userId }: { userId: string }) {
  const { telemetryNotice, branding } = useKon10()
  const consent = useTelemetryConsent()
  const [open, setOpen] = useState(false)

  const enabled = telemetryNotice.enabled === true
  const optIn = telemetryNotice.mode === 'opt-in'
  const ackKey = `${ACK_PREFIX}${userId}`

  useEffect(() => {
    if (!enabled) return
    if (optIn) {
      // Opt-in: prompt until the user makes an explicit choice.
      setOpen(consent.status === 'unset')
      return
    }
    // Notice: show once, then remember it was acknowledged.
    try {
      if (localStorage.getItem(ackKey) !== 'true') setOpen(true)
    } catch {
      // No storage (SSR / privacy mode) — don't nag; skip.
    }
  }, [enabled, optIn, consent.status, ackKey])

  if (!enabled) return null

  const acknowledge = () => {
    try {
      localStorage.setItem(ackKey, 'true')
    } catch {
      // Best-effort — the dialog just reappears later if storage is unavailable.
    }
    setOpen(false)
  }

  const policyLink = telemetryNotice.policyUrl && (
    <Button asChild variant="ghost">
      <a href={telemetryNotice.policyUrl} target="_blank" rel="noreferrer">
        Learn more
      </a>
    </Button>
  )

  if (optIn) {
    return (
      <Dialog
        open={open}
        // Dismissing without choosing leaves consent unset (no tracking) and
        // re-prompts next session; only the buttons record a decision.
        onOpenChange={setOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {telemetryNotice.title ?? `Help improve ${branding.appName}?`}
            </DialogTitle>
            <DialogDescription>
              {telemetryNotice.message ?? DEFAULT_OPTIN_MESSAGE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {policyLink}
            <Button variant="ghost" onClick={() => consent.deny()}>
              No thanks
            </Button>
            <Button onClick={() => consent.grant()}>Allow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && acknowledge()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{telemetryNotice.title ?? DEFAULT_NOTICE_TITLE}</DialogTitle>
          <DialogDescription>
            {telemetryNotice.message ?? DEFAULT_NOTICE_MESSAGE}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {policyLink}
          <Button onClick={acknowledge}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

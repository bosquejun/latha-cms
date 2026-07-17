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
import { useKon10, useStudioNavigate, useTelemetryConsent } from '@kon10/studio-sdk'
import { TelemetryToggles } from './TelemetryToggles.js'

const ACK_PREFIX = 'kon10-telemetry-ack:'

const DEFAULT_NOTICE_TITLE = 'About usage data'
const DEFAULT_NOTICE_MESSAGE =
  'We collect a little anonymous usage data to help make the Studio better. ' +
  'We never see your content or personal details. You can turn this off any ' +
  'time in Settings.'

const DEFAULT_OPTIN_MESSAGE =
  'Help make the Studio better by sharing anonymous usage data. We never see ' +
  'your content or personal details, and you can change this any time.'

const DEFAULT_OPTOUT_MESSAGE =
  'We collect a little anonymous usage data to help make the Studio better. ' +
  'We never see your content or personal details. You are in control, so pick ' +
  'what works for you below.'

export function TelemetryNotice({ userId }: { userId: string }) {
  const { telemetryNotice, branding } = useKon10()
  const consent = useTelemetryConsent()
  const navigate = useStudioNavigate()
  const [open, setOpen] = useState(false)

  const enabled = telemetryNotice.enabled === true
  const mode = telemetryNotice.mode ?? 'notice'
  const ackKey = `${ACK_PREFIX}${userId}`

  useEffect(() => {
    if (!enabled) return
    // Opt-in prompts until an explicit Allow/No-thanks (status-driven). Notice
    // and opt-out show once (ack-driven) — opt-out edits consent via switches
    // in place, so it must NOT close the moment a switch flips the status.
    if (mode === 'opt-in') {
      setOpen(consent.status === 'unset')
      return
    }
    try {
      if (localStorage.getItem(ackKey) !== 'true') setOpen(true)
    } catch {
      // No storage (SSR / privacy mode) — don't nag; skip.
    }
  }, [enabled, mode, consent.status, ackKey])

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

  const manageUrl = telemetryNotice.manageUrl
  const manageButton = manageUrl && (
    <Button
      variant="ghost"
      onClick={() => {
        acknowledge()
        navigate(manageUrl)
      }}
    >
      Manage
    </Button>
  )

  if (mode === 'opt-out') {
    return (
      // Dismissing keeps whatever the switches are set to (default: on,
      // anonymous) and stops re-prompting via the ack flag.
      <Dialog open={open} onOpenChange={(next) => !next && acknowledge()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {telemetryNotice.title ?? `Help make ${branding.appName} better`}
            </DialogTitle>
            <DialogDescription>
              {telemetryNotice.message ?? DEFAULT_OPTOUT_MESSAGE}
            </DialogDescription>
          </DialogHeader>
          {/* The same switches as Settings → Telemetry, right here. */}
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <TelemetryToggles />
          </div>
          <DialogFooter>
            {policyLink}
            {manageButton}
            <Button onClick={acknowledge}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  if (mode === 'opt-in') {
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
              {telemetryNotice.title ?? `Help make ${branding.appName} better?`}
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
          {manageButton}
          <Button onClick={acknowledge}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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

const ACK_PREFIX = 'kon10-telemetry-ack:'

const DEFAULT_NOTICE_TITLE = 'A note on telemetry'
const DEFAULT_NOTICE_MESSAGE =
  'This Studio sends anonymous usage telemetry — technical and product events — ' +
  'to help improve it. No content, credentials, or personal data are collected. ' +
  'You can turn it off any time in the telemetry settings.'

const DEFAULT_OPTIN_MESSAGE =
  'Allow anonymous usage analytics to help improve the product. No content you ' +
  'manage and no personal data is collected, and you can change this anytime.'

const DEFAULT_OPTOUT_MESSAGE =
  'This Studio shares anonymous usage data — technical and product events — to ' +
  'help improve it. No content, credentials, or personal data are collected. You ' +
  'can turn it off, or keep it on but anonymous. Change this anytime in the ' +
  'telemetry settings.'

export function TelemetryNotice({ userId }: { userId: string }) {
  const { telemetryNotice, branding } = useKon10()
  const consent = useTelemetryConsent()
  const navigate = useStudioNavigate()
  const [open, setOpen] = useState(false)

  const enabled = telemetryNotice.enabled === true
  const mode = telemetryNotice.mode ?? 'notice'
  // opt-in and opt-out both prompt for an explicit choice; notice just informs.
  const choice = mode === 'opt-in' || mode === 'opt-out'
  const ackKey = `${ACK_PREFIX}${userId}`

  useEffect(() => {
    if (!enabled) return
    if (choice) {
      // Prompt until the user makes an explicit choice.
      setOpen(consent.status === 'unset')
      return
    }
    // Notice: show once, then remember it was acknowledged.
    try {
      if (localStorage.getItem(ackKey) !== 'true') setOpen(true)
    } catch {
      // No storage (SSR / privacy mode) — don't nag; skip.
    }
  }, [enabled, choice, consent.status, ackKey])

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

  // Accept the default: keep telemetry on, anonymous (no email).
  const keepAnonymous = () => {
    consent.setAnonymous(true)
    consent.grant()
  }

  if (mode === 'opt-out') {
    return (
      <Dialog
        open={open}
        // Dismissing keeps the default (on, anonymous) and stops re-prompting.
        onOpenChange={(next) => {
          if (!next) keepAnonymous()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {telemetryNotice.title ?? `Help improve ${branding.appName}`}
            </DialogTitle>
            <DialogDescription>
              {telemetryNotice.message ?? DEFAULT_OPTOUT_MESSAGE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {policyLink}
            <Button variant="ghost" onClick={() => consent.deny()}>
              Turn off
            </Button>
            <Button onClick={keepAnonymous}>Keep anonymous</Button>
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
          {manageButton}
          <Button onClick={acknowledge}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

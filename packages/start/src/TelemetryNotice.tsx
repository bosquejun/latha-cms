/**
 * TelemetryNotice — a one-time, dismissible transparency dialog shown in the
 * Studio on a user's first sign-in when `studio.telemetryNotice.enabled` is set.
 *
 * It is informational only: acknowledging it does NOT toggle telemetry (that is
 * the operator's decision, made by adding/removing an observability plugin). The
 * "seen" flag is stored per-user in `localStorage`, so it shows once per user
 * per browser — the standard treatment for a disclosure banner, with no schema
 * or RPC changes.
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
import { useKon10 } from '@kon10/studio-sdk'

const STORAGE_PREFIX = 'kon10-telemetry-ack:'

const DEFAULT_TITLE = 'A note on telemetry'
const DEFAULT_MESSAGE =
  'This Studio sends operational telemetry — performance and error traces of ' +
  'Studio actions — to the operator’s monitoring backend to help keep it ' +
  'reliable. It is not used for advertising, and the content you manage is not collected.'

export function TelemetryNotice({ userId }: { userId: string }) {
  const { telemetryNotice } = useKon10()
  const [open, setOpen] = useState(false)

  const enabled = telemetryNotice.enabled === true
  const storageKey = `${STORAGE_PREFIX}${userId}`

  useEffect(() => {
    if (!enabled) return
    try {
      if (localStorage.getItem(storageKey) !== 'true') setOpen(true)
    } catch {
      // No storage (SSR / privacy mode) — don't nag on every load; skip.
    }
  }, [enabled, storageKey])

  if (!enabled) return null

  const acknowledge = () => {
    try {
      localStorage.setItem(storageKey, 'true')
    } catch {
      // Best-effort — if storage is unavailable the dialog just reappears later.
    }
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Any close path (Esc, overlay, X, button) counts as acknowledged.
        if (!next) acknowledge()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{telemetryNotice.title ?? DEFAULT_TITLE}</DialogTitle>
          <DialogDescription>
            {telemetryNotice.message ?? DEFAULT_MESSAGE}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {telemetryNotice.policyUrl && (
            <Button asChild variant="ghost">
              <a href={telemetryNotice.policyUrl} target="_blank" rel="noreferrer">
                Learn more
              </a>
            </Button>
          )}
          <Button onClick={acknowledge}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

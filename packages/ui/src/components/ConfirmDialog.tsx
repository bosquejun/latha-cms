import type { ReactNode } from 'react'

import { Button } from './ui/button.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.js'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Label of the confirming button. Default: "Confirm" ("Delete" when destructive). */
  confirmLabel?: string
  cancelLabel?: string
  /** Style the confirm button as destructive. Default false. */
  destructive?: boolean
  /** Disable actions and show a spinner on the confirm button. */
  busy?: boolean
  /** Called on confirm. The caller closes the dialog (via `onOpenChange`) when done. */
  onConfirm: () => void
}

/**
 * ConfirmDialog — the single confirmation pattern for the design system.
 *
 * Modal dialog with a title, an optional description, and an outline Cancel
 * next to the confirming action. Use `destructive` for irreversible actions
 * (delete, revoke); the triggering control should be `destructive-subtle`,
 * while the confirming button here is the one place solid `destructive` is used.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            loading={busy}
            onClick={onConfirm}
          >
            {confirmLabel ?? (destructive ? 'Delete' : 'Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

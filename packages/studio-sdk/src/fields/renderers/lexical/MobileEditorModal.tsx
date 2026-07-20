import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Button } from '@kon10/ui'
import { Check, ChevronLeft } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * Tracks the visual viewport so the modal can size itself to the *visible*
 * region rather than the layout viewport. When the on-screen keyboard opens the
 * visual viewport shrinks from the bottom; pinning the panel to
 * `{ top: offsetTop, height }` keeps the bottom toolbar floating directly above
 * the keyboard (the Facebook-composer behaviour) instead of being covered by it.
 *
 * Falls back to `window.innerHeight` where the API is unavailable (older
 * browsers, SSR guarded by the `open` gate in the caller).
 */
function useVisualViewport(open: boolean): { top: number; height: number } {
  const [rect, setRect] = useState<{ top: number; height: number }>({
    top: 0,
    height: 0,
  })

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) {
      setRect({ top: 0, height: window.innerHeight })
      return
    }
    const update = () => setRect({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [open])

  return rect
}

/** Focuses the Lexical editor once, when the modal mounts (i.e. opens). */
function FocusOnOpen() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    // Same user gesture that opened the modal, so the mobile keyboard surfaces.
    editor.focus()
  }, [editor])
  return null
}

interface MobileEditorModalProps {
  open: boolean
  title: string
  onClose: () => void
  /** Editing surface — mounts only while open, inside the shared composer. */
  children: ReactNode
}

/**
 * Full-screen, keyboard-aware editor overlay for phones. Portals to
 * `document.body`, sizes itself to the visual viewport, locks background scroll,
 * and lays its children out as a scrollable body over a pinned bottom toolbar
 * (rendered by the caller as the last child).
 */
export function MobileEditorModal({
  open,
  title,
  onClose,
  children,
}: MobileEditorModalProps) {
  const { top, height } = useVisualViewport(open)

  // Lock background scroll and wire Escape while the overlay is open.
  useEffect(() => {
    if (!open) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed left-0 z-50 flex w-full flex-col bg-background"
      style={{ top, height: height || '100dvh' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex items-center gap-inline border-b border-input px-inline py-tight">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{title}</span>
        <Button type="button" size="sm" onClick={onClose}>
          <Check className="size-4" />
          Done
        </Button>
      </header>
      {children}
      <FocusOnOpen />
    </div>
  )
}

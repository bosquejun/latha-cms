/**
 * FloatingLinkEditorPlugin — the inline link editor popover.
 *
 * When the caret enters a link, a small floating panel appears beneath it with
 * the URL and three actions: visit (opens in a new tab), edit (swap in an input
 * to change the URL), and unlink (unwrap the link, keeping its text). Edit and
 * unlink operate on the link node by key — not the live selection — so they
 * stay correct even when focus moves to the popover's input.
 *
 * Buttons `preventDefault` on mousedown so clicking them never blurs the
 * editor (which would drop the selection and hide the popover); the input is
 * exempt so it can take focus, and `updateState` freezes while editing so the
 * popover doesn't vanish mid-edit.
 */
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { $isLinkNode } from '@lexical/link'
import { $findMatchingParent } from '@lexical/utils'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Button, Input } from '@latha/ui'
import { Check, ExternalLink, Pencil, Unlink, X } from 'lucide-react'
import { normalizeUrl } from './linkUtils.js'

const preventBlur = (e: React.MouseEvent) => e.preventDefault()

export interface FloatingLinkEditorPluginProps {
  /** The (position:relative) editor container the popover is placed within. */
  anchorRef: RefObject<HTMLDivElement | null>
}

export function FloatingLinkEditorPlugin({ anchorRef }: FloatingLinkEditorPluginProps) {
  const [editor] = useLexicalComposerContext()
  const [linkKey, setLinkKey] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const updateState = useCallback(() => {
    // While editing, focus is in the popover input — don't let the resulting
    // selection change tear the popover down.
    if (editing) return
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) {
        setLinkKey(null)
        return
      }
      const node = selection.anchor.getNode()
      const link = $isLinkNode(node) ? node : $findMatchingParent(node, $isLinkNode)
      if ($isLinkNode(link)) {
        setLinkKey(link.getKey())
        setUrl(link.getURL())
        const dom = editor.getElementByKey(link.getKey())
        const container = anchorRef.current
        if (dom && container) {
          // Position relative to the editor container (which is position:relative).
          const rect = dom.getBoundingClientRect()
          const base = container.getBoundingClientRect()
          setPos({ top: rect.bottom - base.top + 6, left: rect.left - base.left })
        }
      } else {
        setLinkKey(null)
      }
    })
  }, [editor, editing, anchorRef])

  useEffect(() => {
    const unregisterUpdate = editor.registerUpdateListener(() => updateState())
    const unregisterCmd = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateState()
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
    const reflow = () => updateState()
    window.addEventListener('resize', reflow)
    document.addEventListener('scroll', reflow, true)
    return () => {
      unregisterUpdate()
      unregisterCmd()
      window.removeEventListener('resize', reflow)
      document.removeEventListener('scroll', reflow, true)
    }
  }, [editor, updateState])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if ((!linkKey && !editing) || !pos) return null

  const startEdit = () => {
    setDraft(url)
    setEditing(true)
  }

  const saveEdit = () => {
    const next = normalizeUrl(draft)
    if (next && linkKey) {
      editor.update(() => {
        const node = $getNodeByKey(linkKey)
        if ($isLinkNode(node)) node.setURL(next)
      })
      setUrl(next)
    }
    setEditing(false)
  }

  const unlink = () => {
    if (!linkKey) return
    editor.update(() => {
      const node = $getNodeByKey(linkKey)
      if ($isLinkNode(node)) {
        // Move the link's children up, then drop the now-empty link node.
        const children = node.getChildren()
        for (const child of children) node.insertBefore(child)
        node.remove()
      }
    })
    setLinkKey(null)
    setEditing(false)
  }

  return (
    <div
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 50 }}
      className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {editing ? (
        <>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                saveEdit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
              }
            }}
            placeholder="https://…"
            className="h-7 w-60"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Save"
            onMouseDown={preventBlur}
            onClick={saveEdit}
          >
            <Check className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Cancel"
            onMouseDown={preventBlur}
            onClick={() => setEditing(false)}
          >
            <X className="size-3.5" />
          </Button>
        </>
      ) : (
        <>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onMouseDown={preventBlur}
            className="max-w-60 truncate px-2 text-sm text-primary underline underline-offset-2"
            title={url}
          >
            {url}
          </a>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Edit link"
            onMouseDown={preventBlur}
            onClick={startEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Open in new tab"
            onMouseDown={preventBlur}
            onClick={() => window.open(url, '_blank', 'noreferrer')}
          >
            <ExternalLink className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            title="Remove link"
            onMouseDown={preventBlur}
            onClick={unlink}
          >
            <Unlink className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}

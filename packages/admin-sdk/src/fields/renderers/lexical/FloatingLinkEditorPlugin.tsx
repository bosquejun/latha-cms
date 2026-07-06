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
  $createTextNode,
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
  const [label, setLabel] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [labelDraft, setLabelDraft] = useState('')
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
        setLabel(link.getTextContent())
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
    setLabelDraft(label)
    setEditing(true)
  }

  const saveEdit = () => {
    const nextUrl = normalizeUrl(draft)
    const nextLabel = labelDraft.trim()
    if (nextUrl && linkKey) {
      editor.update(() => {
        const node = $getNodeByKey(linkKey)
        if (!$isLinkNode(node)) return
        node.setURL(nextUrl)
        // Swap the link's display text when it changed. Append the new text
        // node *before* removing the old children so the link never goes empty
        // (Lexical garbage-collects empty element nodes). Collapses any inline
        // formatting inside the link to plain text — fine for a label edit.
        if (nextLabel && nextLabel !== node.getTextContent()) {
          const replacement = $createTextNode(nextLabel)
          node.append(replacement)
          for (const child of node.getChildren()) {
            if (child.getKey() !== replacement.getKey()) child.remove()
          }
        }
      })
      setUrl(nextUrl)
      if (nextLabel) setLabel(nextLabel)
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(false)
    }
  }

  return (
    <div
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 50 }}
      className="rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {editing ? (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-caption text-muted-foreground">Text</span>
            <Input
              ref={inputRef}
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Link text"
              className="h-7 w-60"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-caption text-muted-foreground">URL</span>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="https://…"
              className="h-7 w-60"
            />
          </label>
          <div className="flex justify-end gap-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onMouseDown={preventBlur}
              onClick={() => setEditing(false)}
            >
              <X className="size-3.5" /> Cancel
            </Button>
            <Button type="button" size="sm" onMouseDown={preventBlur} onClick={saveEdit}>
              <Check className="size-3.5" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-0.5">
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
        </div>
      )}
    </div>
  )
}

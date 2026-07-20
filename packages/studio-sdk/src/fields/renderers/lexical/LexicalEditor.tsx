import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import type { EditorState } from 'lexical'
import { Fragment, useMemo, useRef, useState } from 'react'
import { InitialValuePlugin } from './InitialValuePlugin.js'
import { ImageNode } from './ImageNode.js'
import { FloatingLinkEditorPlugin } from './FloatingLinkEditorPlugin.js'
import { ToolbarPlugin } from './ToolbarPlugin.js'
import { MobileEditorModal } from './MobileEditorModal.js'
import { lexicalToPlainText } from './preview.js'
import { getGlobalLexicalExtensions, type LexicalExtension } from './registry.js'
import { useIsPhone } from '../../../shell/useMediaQuery.js'

const BUILT_IN_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  ImageNode,
]

// Base theme classes for nodes that need styling the browser doesn't give for
// free inside a contentEditable — notably links, headings (Tailwind preflight
// strips h1-h6 default sizing), and underline/strikethrough (Lexical only
// emits semantic tags for bold/italic; these two rely entirely on theme
// classes). Module/field themes merge on top (and win) via the Object.assign
// order below.
const BASE_THEME = {
  link: 'text-primary underline underline-offset-2 cursor-pointer',
  heading: {
    h2: 'text-xl font-semibold',
    h3: 'text-lg font-semibold',
    h4: 'text-base font-semibold',
  },
  text: {
    underline: 'underline underline-offset-2',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline underline-offset-2 line-through',
  },
}

interface LexicalEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  lexicalConfig?: LexicalExtension
  /** Field label — used as the header title of the phone full-screen editor. */
  label?: string
}

export function LexicalEditor({
  id,
  value,
  onChange,
  onBlur,
  lexicalConfig,
  label,
}: LexicalEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isPhone = useIsPhone()
  const [open, setOpen] = useState(false)
  const preview = useMemo(
    () => (isPhone ? lexicalToPlainText(value) : ''),
    [isPhone, value],
  )
  const globalExts = getGlobalLexicalExtensions()

  const allNodes = [
    ...BUILT_IN_NODES,
    ...globalExts.flatMap((e) => e.nodes ?? []),
    ...(lexicalConfig?.nodes ?? []),
  ]

  const allPlugins = [
    ...globalExts.flatMap((e) => e.plugins ?? []),
    ...(lexicalConfig?.plugins ?? []),
  ]

  const mergedTheme = Object.assign(
    {},
    BASE_THEME,
    ...globalExts.map((e) => e.theme ?? {}),
    lexicalConfig?.theme ?? {},
  )

  function handleChange(editorState: EditorState) {
    onChange(JSON.stringify(editorState.toJSON()))
  }

  // The editing surface (content-editable + placeholder). Shared verbatim by the
  // desktop inline card and the phone full-screen modal so both drive the one
  // editor instance. `id` lands on the desktop content-editable; on phones it
  // labels the trigger button instead (below) to keep the id unique.
  const editingSurface = (
    <div className="relative px-group py-inline">
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            id={isPhone ? undefined : id}
            className="min-h-24 text-base outline-none md:text-sm"
            onBlur={onBlur}
          />
        }
        placeholder={
          <div className="pointer-events-none absolute left-3 top-2 select-none text-base text-muted-foreground md:text-sm">
            Enter text…
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
    </div>
  )

  return (
    <LexicalComposer
      initialConfig={{
        namespace: id ?? 'richtext-editor',
        nodes: allNodes,
        theme: mergedTheme,
        onError(error: Error) {
          console.error('[Lexical]', error)
        },
      }}
    >
      {isPhone ? (
        <>
          {/* Collapsed trigger: looks like the field input, shows a text preview,
              and opens the full-screen editor on tap. */}
          <button
            type="button"
            id={id}
            onClick={() => setOpen(true)}
            className="flex min-h-24 w-full flex-col rounded-md border border-input bg-background px-group py-inline text-left text-base"
          >
            {preview ? (
              <span className="line-clamp-4 whitespace-pre-wrap break-words">{preview}</span>
            ) : (
              <span className="text-muted-foreground">Enter text…</span>
            )}
          </button>

          <MobileEditorModal
            open={open}
            title={label ?? 'Edit text'}
            onClose={() => {
              setOpen(false)
              onBlur()
            }}
          >
            <div
              ref={containerRef}
              className="relative flex-1 overflow-y-auto overscroll-contain"
            >
              {editingSurface}
              <FloatingLinkEditorPlugin anchorRef={containerRef} />
            </div>
            <ToolbarPlugin placement="bottom" />
          </MobileEditorModal>
        </>
      ) : (
        <div
          ref={containerRef}
          className="relative rounded-md border border-input bg-background text-sm"
        >
          <ToolbarPlugin />
          {editingSurface}
          <FloatingLinkEditorPlugin anchorRef={containerRef} />
        </div>
      )}

      {/* Editor-wide plugins — always mounted regardless of layout. */}
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <InitialValuePlugin value={value} />
      <OnChangePlugin onChange={handleChange} ignoreSelectionChange={true} />
      {allPlugins.map((plugin, i) => (
        <Fragment key={i}>{plugin}</Fragment>
      ))}
    </LexicalComposer>
  )
}

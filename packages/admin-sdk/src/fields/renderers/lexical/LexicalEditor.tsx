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
import { Fragment, useRef } from 'react'
import { InitialValuePlugin } from './InitialValuePlugin.js'
import { ImageNode } from './ImageNode.js'
import { FloatingLinkEditorPlugin } from './FloatingLinkEditorPlugin.js'
import { ToolbarPlugin } from './ToolbarPlugin.js'
import { getGlobalLexicalExtensions, type LexicalExtension } from './registry.js'

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
// free inside a contentEditable — notably links. Module/field themes merge on
// top (and win) via the Object.assign order below.
const BASE_THEME = {
  link: 'text-primary underline underline-offset-2 cursor-pointer',
}

interface LexicalEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  lexicalConfig?: LexicalExtension
}

export function LexicalEditor({ id, value, onChange, onBlur, lexicalConfig }: LexicalEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
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
      <div ref={containerRef} className="relative rounded-md border border-input bg-background text-sm">
        <ToolbarPlugin />
        <div className="relative px-3 py-2">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                id={id}
                className="min-h-24 outline-none"
                onBlur={onBlur}
              />
            }
            placeholder={
              <div className="pointer-events-none absolute left-3 top-2 select-none text-muted-foreground">
                Enter text…
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <FloatingLinkEditorPlugin anchorRef={containerRef} />
        <InitialValuePlugin value={value} />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange={true} />
        {allPlugins.map((plugin, i) => (
          <Fragment key={i}>{plugin}</Fragment>
        ))}
      </div>
    </LexicalComposer>
  )
}

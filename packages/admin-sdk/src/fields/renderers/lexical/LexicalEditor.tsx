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
import { InitialValuePlugin } from './InitialValuePlugin.js'
import { ToolbarPlugin } from './ToolbarPlugin.js'

const NODES = [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode]

interface LexicalEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
}

export function LexicalEditor({ id, value, onChange, onBlur }: LexicalEditorProps) {
  function handleChange(editorState: EditorState) {
    onChange(JSON.stringify(editorState.toJSON()))
  }

  return (
    <LexicalComposer
      initialConfig={{
        namespace: id ?? 'richtext-editor',
        nodes: NODES,
        theme: {},
        onError(error: Error) {
          console.error('[Lexical]', error)
        },
      }}
    >
      <div className="rounded-md border border-input bg-background text-sm">
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
        <InitialValuePlugin value={value} />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange={true} />
      </div>
    </LexicalComposer>
  )
}

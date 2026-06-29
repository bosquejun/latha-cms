import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef } from 'react'

/** One-shot plugin that loads a serialized Lexical JSON string into the editor on mount. */
export function InitialValuePlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || !value) return
    initialized.current = true
    try {
      const state = editor.parseEditorState(value)
      queueMicrotask(() => editor.setEditorState(state))
    } catch {
      // Invalid JSON — start with an empty editor state
    }
  }, [editor, value])

  return null
}

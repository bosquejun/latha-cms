/**
 * lexicalToPlainText — flatten a serialized Lexical editor state into plain text
 * for the collapsed phone field trigger (the read-only preview shown before the
 * full-screen editor opens). Top-level blocks are separated by newlines; every
 * other node contributes only its `text`. Any parse failure yields an empty
 * string so the trigger falls back to its placeholder.
 */

interface LexicalNode {
  text?: string
  children?: LexicalNode[]
}

function nodeToText(node: LexicalNode): string {
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.children)) return node.children.map(nodeToText).join('')
  return ''
}

export function lexicalToPlainText(value: string): string {
  if (!value) return ''
  try {
    const root = (JSON.parse(value) as { root?: LexicalNode }).root
    if (!root || !Array.isArray(root.children)) return ''
    return root.children
      .map(nodeToText)
      .join('\n')
      .replace(/\n{2,}/g, '\n')
      .trim()
  } catch {
    return ''
  }
}

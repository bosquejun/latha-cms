import type { Klass, LexicalNode, EditorThemeClasses } from 'lexical'
import type { ReactNode } from 'react'

declare module '@kon10/core' {
  interface RichTextExtensions {
    nodes?: Klass<LexicalNode>[]
    plugins?: ReactNode[]
    theme?: EditorThemeClasses
  }
}

export type LexicalExtension = {
  nodes?: Klass<LexicalNode>[]
  plugins?: ReactNode[]
  theme?: EditorThemeClasses
}

const globalExtensions: LexicalExtension[] = []

export function registerLexicalExtension(ext: LexicalExtension): void {
  globalExtensions.push(ext)
}

export function getGlobalLexicalExtensions(): readonly LexicalExtension[] {
  return globalExtensions
}

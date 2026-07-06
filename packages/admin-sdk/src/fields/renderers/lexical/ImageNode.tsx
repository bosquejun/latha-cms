/**
 * ImageNode — a block-level image for the rich-text editor.
 *
 * A Lexical `DecoratorNode` that renders an `<img>` and serializes to
 * `{ src, altText }` inside the editor's JSON state, so images round-trip
 * through save/load like any other node. `exportDOM` emits a plain `<img>` for
 * headless/API consumers that render the content to HTML. Inserted via the
 * toolbar's image button (see `ToolbarPlugin`), which uploads through the
 * generic client and drops the returned URL in here.
 */
import { DecoratorNode } from 'lexical'
import type {
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical'
import type { ReactNode } from 'react'

export type SerializedImageNode = Spread<
  { src: string; altText: string },
  SerializedLexicalNode
>

export class ImageNode extends DecoratorNode<ReactNode> {
  __src: string
  __altText: string

  static override getType(): string {
    return 'image'
  }

  static override clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__key)
  }

  constructor(src: string, altText: string, key?: NodeKey) {
    super(key)
    this.__src = src
    this.__altText = altText
  }

  static override importJSON(serialized: SerializedImageNode): ImageNode {
    return $createImageNode(serialized.src, serialized.altText)
  }

  override exportJSON(): SerializedImageNode {
    return { type: 'image', version: 1, src: this.__src, altText: this.__altText }
  }

  /** A figure sits on its own line, not inline within a paragraph. */
  override isInline(): boolean {
    return false
  }

  override createDOM(): HTMLElement {
    // `display: contents` keeps the wrapper out of layout; the decorated
    // <img> is what actually renders.
    const el = document.createElement('div')
    el.style.display = 'contents'
    return el
  }

  override updateDOM(): boolean {
    return false
  }

  override exportDOM(): DOMExportOutput {
    const img = document.createElement('img')
    img.setAttribute('src', this.__src)
    if (this.__altText) img.setAttribute('alt', this.__altText)
    return { element: img }
  }

  override decorate(): ReactNode {
    return (
      <img
        src={this.__src}
        alt={this.__altText}
        className="my-2 max-h-96 max-w-full rounded-md border border-border"
      />
    )
  }
}

export function $createImageNode(src: string, altText = ''): ImageNode {
  return new ImageNode(src, altText)
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}

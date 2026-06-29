import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useState, useCallback } from 'react'
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
} from 'lexical'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { $findMatchingParent } from '@lexical/utils'
import { Button, Separator } from '@latha/ui'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isCode, setIsCode] = useState(false)
  const [blockType, setBlockType] = useState<string>('paragraph')

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return

        setIsBold(selection.hasFormat('bold'))
        setIsItalic(selection.hasFormat('italic'))
        setIsUnderline(selection.hasFormat('underline'))
        setIsStrikethrough(selection.hasFormat('strikethrough'))
        setIsCode(selection.hasFormat('code'))

        const anchorNode = selection.anchor.getNode()
        const element =
          anchorNode.getKey() === 'root'
            ? anchorNode
            : ($findMatchingParent(anchorNode, (e) => {
                const parent = e.getParent()
                return parent !== null && parent.getKey() === 'root'
              }) ?? anchorNode.getTopLevelElementOrThrow())

        if ($isHeadingNode(element)) {
          setBlockType(element.getTag())
        } else if ($isListNode(element)) {
          setBlockType(element.getListType())
        } else if ($isQuoteNode(element)) {
          setBlockType('quote')
        } else {
          setBlockType(element.getType())
        }
      })
    })
  }, [editor])

  const formatHeading = useCallback(
    (tag: 'h2' | 'h3' | 'h4') => {
      editor.update(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return
        if (blockType === tag) {
          $setBlocksType(selection, () => $createParagraphNode())
        } else {
          $setBlocksType(selection, () => $createHeadingNode(tag))
        }
      })
    },
    [editor, blockType],
  )

  const formatQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      if (blockType === 'quote') {
        $setBlocksType(selection, () => $createParagraphNode())
      } else {
        $setBlocksType(selection, () => $createQuoteNode())
      }
    })
  }, [editor, blockType])

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-2 py-1.5">
      {/* History */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        title="Undo (⌘Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        title="Redo (⌘⇧Z)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Inline formatting */}
      <Button
        type="button"
        size="icon"
        variant={isBold ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        title="Bold (⌘B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={isItalic ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        title="Italic (⌘I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={isUnderline ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        title="Underline (⌘U)"
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={isStrikethrough ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
        title="Strikethrough (⌘⇧X)"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={isCode ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        title="Inline code (⌘E)"
      >
        <Code className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Block types */}
      <Button
        type="button"
        size="icon"
        variant={blockType === 'h2' ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => formatHeading('h2')}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={blockType === 'h3' ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => formatHeading('h3')}
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={blockType === 'h4' ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => formatHeading('h4')}
        title="Heading 4"
      >
        <Heading4 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={blockType === 'quote' ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={formatQuote}
        title="Blockquote"
      >
        <Quote className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Lists */}
      <Button
        type="button"
        size="icon"
        variant={blockType === 'bullet' ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => {
          if (blockType === 'bullet') {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
          } else {
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
          }
        }}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={blockType === 'number' ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={() => {
          if (blockType === 'number') {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
          } else {
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
          }
        }}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

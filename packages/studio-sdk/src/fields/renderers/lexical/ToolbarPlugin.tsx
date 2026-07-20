import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef, useState, useCallback } from 'react'
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
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $findMatchingParent, $insertNodeToNearestRoot } from '@lexical/utils'
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Spinner,
  toast,
} from '@kon10/ui'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import { useKon10 } from '../../../client/index.js'
import { $createImageNode } from './ImageNode.js'
import { normalizeUrl } from './linkUtils.js'

interface ToolbarPluginProps {
  /**
   * Where the toolbar sits relative to the editing surface. `'top'` (default,
   * desktop inline layout) draws a bottom divider; `'bottom'` (the phone
   * full-screen modal, where the bar is pinned above the keyboard) draws a top
   * divider and reserves the home-indicator safe area.
   */
  placement?: 'top' | 'bottom'
}

export function ToolbarPlugin({ placement = 'top' }: ToolbarPluginProps = {}) {
  const [editor] = useLexicalComposerContext()
  const { client } = useKon10()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isCode, setIsCode] = useState(false)
  const [isLink, setIsLink] = useState(false)
  const [uploading, setUploading] = useState(false)
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

        const node = selection.anchor.getNode()
        setIsLink($isLinkNode(node) || $isLinkNode(node.getParent()))

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

  const formatParagraph = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      $setBlocksType(selection, () => $createParagraphNode())
    })
  }, [editor])

  const toggleBulletList = useCallback(() => {
    if (blockType === 'bullet') {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    }
  }, [blockType, editor])

  const toggleNumberedList = useCallback(() => {
    if (blockType === 'number') {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    }
  }, [blockType, editor])

  const toggleLink = useCallback(() => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      return
    }
    const url = normalizeUrl(window.prompt('Link URL') ?? '')
    if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
  }, [editor, isLink])

  const insertImage = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const doc = await client.upload(file)
        const src = typeof doc.url === 'string' ? doc.url : ''
        if (!src) throw new Error('Upload returned no URL.')
        const alt = typeof doc.filename === 'string' ? doc.filename : ''
        editor.update(() => {
          $insertNodeToNearestRoot($createImageNode(src, alt))
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Image upload failed.')
      } finally {
        setUploading(false)
      }
    },
    [client, editor],
  )

  // The mobile "More" menu now only carries inline character formats and lists;
  // block/text style lives in its own toolbar dropdown (below).
  const hasOverflowFormat =
    isUnderline ||
    isStrikethrough ||
    isCode ||
    blockType === 'bullet' ||
    blockType === 'number'

  // The dedicated block-style dropdown reflects the current block in its trigger
  // icon and highlights when the block is anything other than a plain paragraph.
  const blockTypeActive = ['h2', 'h3', 'h4', 'quote'].includes(blockType)
  const CurrentBlockIcon =
    blockType === 'h2'
      ? Heading2
      : blockType === 'h3'
        ? Heading3
        : blockType === 'h4'
          ? Heading4
          : blockType === 'quote'
            ? Quote
            : Pilcrow

  return (
    <div
      className={
        placement === 'bottom'
          ? 'border-t border-input px-inline py-tight pb-[calc(var(--space-tight)+env(safe-area-inset-bottom))]'
          : 'border-b border-input px-inline py-tight'
      }
    >
      <div
        className="flex items-center gap-0.5 md:hidden"
        role="toolbar"
        aria-label="Text formatting"
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          aria-label="Undo"
          title="Undo"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={isBold ? 'secondary' : 'ghost'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
          aria-label="Bold"
          aria-pressed={isBold}
          title="Bold"
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={isItalic ? 'secondary' : 'ghost'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
          aria-label="Italic"
          aria-pressed={isItalic}
          title="Italic"
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={isLink ? 'secondary' : 'ghost'}
          onClick={toggleLink}
          aria-label={isLink ? 'Remove link' : 'Add link'}
          aria-pressed={isLink}
          title={isLink ? 'Remove link' : 'Add link'}
        >
          <Link2 className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={blockTypeActive ? 'secondary' : 'ghost'}
              aria-label="Text style"
              title="Text style"
            >
              <CurrentBlockIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            collisionPadding={16}
            className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-56 overscroll-contain overflow-y-auto"
          >
            <DropdownMenuLabel>Text style</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={blockType === 'paragraph'}
              onCheckedChange={formatParagraph}
            >
              <Pilcrow className="size-4" />
              Paragraph
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={blockType === 'h2'}
              onCheckedChange={() => formatHeading('h2')}
            >
              <Heading2 className="size-4" />
              Heading 2
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={blockType === 'h3'}
              onCheckedChange={() => formatHeading('h3')}
            >
              <Heading3 className="size-4" />
              Heading 3
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={blockType === 'h4'}
              onCheckedChange={() => formatHeading('h4')}
            >
              <Heading4 className="size-4" />
              Heading 4
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={blockType === 'quote'}
              onCheckedChange={formatQuote}
            >
              <Quote className="size-4" />
              Blockquote
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={hasOverflowFormat ? 'secondary' : 'ghost'}
              aria-label="More formatting options"
              title="More formatting options"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            collisionPadding={16}
            className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-64 overscroll-contain overflow-y-auto"
          >
            <DropdownMenuLabel>History</DropdownMenuLabel>
            <DropdownMenuItem
              className="min-h-tap"
              onSelect={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
            >
              <Redo2 />
              Redo
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Format</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={isUnderline}
              onCheckedChange={() =>
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')
              }
            >
              <Underline className="size-4" />
              Underline
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={isStrikethrough}
              onCheckedChange={() =>
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
              }
            >
              <Strikethrough className="size-4" />
              Strikethrough
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={isCode}
              onCheckedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
            >
              <Code className="size-4" />
              Inline code
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Lists</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={blockType === 'bullet'}
              onCheckedChange={toggleBulletList}
            >
              <List className="size-4" />
              Bullet list
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="min-h-tap"
              checked={blockType === 'number'}
              onCheckedChange={toggleNumberedList}
            >
              <ListOrdered className="size-4" />
              Numbered list
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Insert</DropdownMenuLabel>
            <DropdownMenuItem
              className="min-h-tap"
              disabled={uploading}
              onSelect={() => fileInputRef.current?.click()}
            >
              {uploading ? <Spinner className="size-4" /> : <ImagePlus className="size-4" />}
              {uploading ? 'Uploading image…' : 'Image'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className="hidden flex-wrap items-center gap-0.5 md:flex"
        role="toolbar"
        aria-label="Text formatting"
      >
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

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Button
        type="button"
        size="icon"
        variant={isLink ? 'secondary' : 'ghost'}
        className="h-7 w-7"
        onClick={toggleLink}
        title={isLink ? 'Remove link' : 'Add link'}
      >
        <Link2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        title="Insert image"
      >
        {uploading ? (
          <Spinner className="size-3.5" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
      </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void insertImage(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

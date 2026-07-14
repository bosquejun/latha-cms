/**
 * Sheet — a Radix-Dialog-backed panel that slides in from a viewport edge.
 *
 * Same primitive as `Dialog` (scroll lock, Escape, focus trap, scrim) but
 * anchored to an edge via the `side` prop instead of centered. The `'bottom'`
 * variant is the mobile bottom-sheet: full width, rounded top, capped at 85vh
 * with its body scrolling, and padded past the home-indicator safe area.
 */
import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils.js'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

type SheetSide = 'top' | 'bottom' | 'left' | 'right'

const sideClasses: Record<SheetSide, string> = {
  top: 'inset-x-0 top-0 max-h-[85dvh] rounded-b-xl border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top',
  bottom:
    'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t pb-[calc(var(--space-card)+env(safe-area-inset-bottom))] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
  left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm rounded-r-xl border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
  right:
    'inset-y-0 right-0 h-full w-3/4 max-w-sm rounded-l-xl border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
}

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: SheetSide }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed z-50 flex flex-col gap-card overflow-y-auto bg-card p-card shadow-overlay duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <SheetClose className="absolute right-1.5 top-1.5 flex size-11 touch-manipulation items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none md:right-2.5 md:top-2.5 md:size-9">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </SheetClose>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sheet-header" className={cn('flex flex-col gap-field', className)} {...props} />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('flex flex-col-reverse gap-inline sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('pr-8 text-h2 font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-caption text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}

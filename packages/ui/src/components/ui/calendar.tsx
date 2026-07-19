import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'

import { cn } from '../../lib/utils.js'
import { buttonVariants } from './button.js'

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-2', className)}
      classNames={{
        months: cn('flex flex-col', defaults.months),
        month: cn('space-y-2', defaults.month),
        month_caption: cn('relative flex h-8 items-center justify-center text-sm font-medium', defaults.month_caption),
        nav: cn('absolute inset-x-2 top-2 flex items-center justify-between', defaults.nav),
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'size-8 min-h-8 min-w-8', defaults.button_previous),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'size-8 min-h-8 min-w-8', defaults.button_next),
        month_grid: cn('w-full border-collapse', defaults.month_grid),
        weekdays: cn('flex', defaults.weekdays),
        weekday: cn('w-9 text-center text-xs font-normal text-muted-foreground', defaults.weekday),
        week: cn('mt-1 flex', defaults.week),
        day: cn('relative size-9 p-0 text-center text-sm', defaults.day),
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'size-9 p-0 font-normal aria-selected:bg-primary aria-selected:text-primary-foreground'),
        today: cn('rounded-md bg-accent text-accent-foreground', defaults.today),
        outside: cn('text-muted-foreground opacity-50', defaults.outside),
        disabled: cn('text-muted-foreground opacity-40', defaults.disabled),
        hidden: cn('invisible', defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left'
            ? <ChevronLeft className="size-4" />
            : <ChevronRight className="size-4" />,
      }}
      {...props}
    />
  )
}

export { Calendar }

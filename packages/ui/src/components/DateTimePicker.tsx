import { format } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import * as React from 'react'

import { cn } from '../lib/utils.js'
import { Button } from './ui/button.js'
import { Calendar } from './ui/calendar.js'
import { Input } from './ui/input.js'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js'

export interface DateTimePickerProps {
  id?: string
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  min?: string
  max?: string
  defaultDate?: Date
  disabled?: boolean
  className?: string
}

function validDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function withTime(date: Date, time: string) {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const next = new Date(date)
  next.setHours(hours, minutes, 0, 0)
  return next
}

function clamp(date: Date, min?: Date, max?: Date) {
  if (min && date < min) return min
  if (max && date > max) return max
  return date
}

function DateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  min,
  max,
  defaultDate = new Date(),
  disabled,
  className,
}: DateTimePickerProps) {
  const selected = validDate(value)
  const minDate = validDate(min)
  const maxDate = validDate(max)
  const time = selected ? format(selected, 'HH:mm') : format(defaultDate, 'HH:mm')
  const disabledDates = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]

  const commit = (date: Date) => {
    onChange(clamp(date, minDate, maxDate).toISOString())
    onBlur?.()
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label="Choose date and time"
            className={cn('min-w-0 flex-1 justify-start px-group font-normal', !selected && 'text-muted-foreground')}
          >
            <CalendarIcon className="size-4" />
            <span className="truncate">
              {selected ? format(selected, 'MMM d, yyyy · h:mm a') : 'Choose date and time'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-1.5rem))]">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? defaultDate}
            startMonth={minDate}
            endMonth={maxDate}
            disabled={disabledDates}
            onSelect={(date) => date && commit(withTime(date, time))}
          />
          <div className="flex items-center gap-inline border-t p-inline">
            <Input
              type="time"
              size="sm"
              aria-label="Time"
              value={time}
              disabled={disabled}
              onChange={(event) => commit(withTime(selected ?? defaultDate, event.target.value))}
              className="w-auto flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => commit(defaultDate)}
            >
              Today
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear date and time"
          onClick={() => {
            onChange('')
            onBlur?.()
          }}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}

export { DateTimePicker }

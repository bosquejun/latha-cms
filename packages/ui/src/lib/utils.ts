import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Register custom spacing scale names so tailwind-merge can detect conflicts
// between semantic tokens (e.g. py-card vs p-0, p-inline vs py-card, etc.)
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        'card', 'card-gap', 'page', 'page-gap', 'section',
        'group', 'form', 'field', 'inline', 'stack', 'tight',
        'sidebar', 'empty',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

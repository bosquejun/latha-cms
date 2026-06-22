/**
 * @latha/ui — the LathaCMS design system.
 *
 * shadcn/ui primitives (new-york, neutral) plus a couple of thin composites.
 * Pure and CMS-unaware: usable standalone, contains no CMS knowledge. Import
 * `@latha/ui/styles.css` once at the app root for the Tailwind v4 theme.
 */

export { cn } from '@/lib/utils'

// Primitives (shadcn/ui)
export { Button, buttonVariants } from './components/ui/button.js'
export { Input } from './components/ui/input.js'
export { Textarea } from './components/ui/textarea.js'
export { Label } from './components/ui/label.js'
export { Badge, badgeVariants } from './components/ui/badge.js'
export {
  StatusBadge,
  type StatusBadgeProps,
} from './components/ui/status-badge.js'
export { Avatar, type AvatarProps } from './components/ui/avatar.js'
export { Separator, type SeparatorProps } from './components/ui/separator.js'
export { Switch, type SwitchProps } from './components/ui/switch.js'
export { Checkbox, type CheckboxProps } from './components/ui/checkbox.js'
export { Tabs, type TabsProps, type TabItem } from './components/ui/tabs.js'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/ui/card.js'
export {
  Select as SelectRoot,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/ui/select.js'

// Table primitives — exported under short aliases for ergonomic use.
export {
  Table,
  TableHeader as THead,
  TableBody as TBody,
  TableRow as TR,
  TableHead as TH,
  TableCell as TD,
  TableFooter,
  TableCaption,
} from './components/ui/table.js'

// Composites
export { Field, type FieldProps } from './components/Field.js'
export {
  SelectInput as Select,
  type SelectInputProps,
  type SelectOption,
} from './components/SelectInput.js'

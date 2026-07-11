# @kon10/ui

Kon10's CMS-unaware design system. It packages Tailwind v4 tokens, shadcn/ui-style primitives, Radix-backed overlays, and small reusable form/composition components.

## Install

```bash
pnpm add @kon10/ui react react-dom
```

Import the stylesheet once at the application root:

```ts
import '@kon10/ui/styles.css'
```

## Public API

- Primitives including `Button`, `Input`, `Textarea`, `Label`, `Badge`, `Card`, `Tabs`, `Dialog`, `Tooltip`, `DropdownMenu`, and table aliases.
- Feedback components such as `Alert`, `Skeleton`, `Spinner`, `StatusBadge`, `Toaster`, and `toast`.
- Composites including `Field`, `Select`, `CopyButton`, and `PasswordInput`.
- `cn()` for class-name composition.

## Example

```tsx
import '@kon10/ui/styles.css'
import { Button, Field, Input } from '@kon10/ui'

export function Example() {
  return (
    <Field label="Title">
      <Input placeholder="Untitled" />
      <Button>Save</Button>
    </Field>
  )
}
```

## Design notes

- Keep this package free of CMS concepts and data fetching.
- Follow the local design guidance in `DESIGN.md` before changing tokens or primitive behavior.
- Prefer accessible Radix primitives and explicit labels for interactive controls.

## Related documentation

- [Design guide](./DESIGN.md)
- [UI conventions](../../docs/ui-conventions.md)
- [Root README](../../README.md)

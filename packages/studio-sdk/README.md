# @kon10/studio-sdk

CMS-aware React SDK for Kon10 Studio. It contains the shell, navigation model, extension registry, field renderer registry, generated entity list/form views, and typed RPC client primitives.

## Install

```bash
pnpm add @kon10/studio-sdk @kon10/core @kon10/ui react
```

Applications usually receive this package through `@kon10/start`; import it directly when building custom Studio surfaces or framework adapters.

## Public API

- Studio shell components such as `StudioShell`, `PageLayout`, and `PageHeader`.
- `EntityList` and `EntityForm` generated views.
- Field renderer registration with `registerFieldRenderer()`.
- Extension helpers such as `defineStudioExtensions()`, `Slot`, and `collectStudioExtensions()`.
- `createKon10Client()`, `Kon10Provider`, `useKon10()`, and RPC types.

## Example

```tsx
import { defineWidgetConfig, type WidgetContext } from '@kon10/studio-sdk'

export const config = defineWidgetConfig({ zone: 'form.sidebar.before' })

export default function EditorialHelp({ entity }: WidgetContext) {
  return <aside>Review the {entity.slug} publishing checklist.</aside>
}
```

## Design notes

- This package is CMS-aware but framework-agnostic. Routing and server functions belong in framework adapters such as `@kon10/start`.
- Keep reusable visual primitives in `@kon10/ui`; Studio-specific composition belongs here.
- Prefer extension zones over hard-coded app customizations.

## Related documentation

- [Studio extensions](../../docs/studio-extensions.md)
- [UI conventions](../../docs/ui-conventions.md)
- [Root README](../../README.md)

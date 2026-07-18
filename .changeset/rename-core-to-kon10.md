---
"kon10": minor
---

Rename the kernel package from the scoped `@kon10/core` to the unscoped `kon10`. The package now publishes as `kon10`; import the kernel via `import { ... } from 'kon10'` instead of `'@kon10/core'`, and depend on `kon10` in `package.json`. All workspace packages have been updated to the new specifier. Other `@kon10/*` package names are unchanged.

---
"@kon10/core": minor
---

Revert the kernel package name back to the scoped `@kon10/core`. The unscoped `kon10` name was rejected on npm for being too similar to `konva`, so the package continues to publish as `@kon10/core`. Import the kernel via `import { ... } from '@kon10/core'` and depend on `@kon10/core` in `package.json`.

---
'@kon10/studio-sdk': minor
'@kon10/start': patch
'@kon10/auth': patch
---

feat: layout-shaped loading skeletons on Studio pages

Every auto-generated Studio page now shows a skeleton that mirrors its own
layout while it waits on data, instead of a bare centered spinner — the page
keeps its shape and no longer reflows when content lands.

`@kon10/studio-sdk` gains four composable, CMS-aware skeletons built on the
`@kon10/ui` `Skeleton` primitive: `ListSkeleton` (header + table rows),
`FormSkeleton` (header + toolbar + field rows, optional sidebar),
`DashboardSkeleton` (stat-card grid), and the shared `PageHeaderSkeleton`.
`LoadingState` remains the generic fallback and the app-boot indicator.

`@kon10/start` wires these into the built-in views — list, create, edit, and
global forms render the matching skeleton, and edit/global forms derive their
skeleton's field count and sidebar from the loaded entity descriptor. Dashboard
stat tiles use a small inline skeleton in place of the `·` placeholder.
`@kon10/auth`'s API Keys settings page swaps its spinner for a list skeleton.

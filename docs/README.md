# Kon10 Documentation

This directory contains product-facing v1 documentation for Kon10. Development
notes, task plans, temporary implementation specs, and agent-only planning files
are intentionally kept out of the public docs tree.

## Reference docs

| Doc | What it covers |
|---|---|
| [Concepts](./concepts/) | Core vocabulary, content modeling, authorization, and framework integration. |
| [Migrations](./concepts/migrations.md) | What boot-time schema reconciliation does — and the rename/retype/remove changes it deliberately does not. |
| [Deployment](./deployment.md) | Production checklist: `AUTH_SECRET`, admin seed, database, media storage, cache, rate limiting, logging. |
| [Studio extensions](./studio-extensions.md) | How apps and modules customize the Studio with widgets, pages, field renderers, list views, and nav links. |
| [Studio UI conventions](./ui-conventions.md) | Shared interaction and visual conventions for buttons, confirmations, and empty states. |
| [Recipes](./recipes/) | Practical patterns — e.g. [webhooks from lifecycle hooks](./recipes/webhooks.md). |

For the broader project specification, see [`../SPEC.md`](../SPEC.md).

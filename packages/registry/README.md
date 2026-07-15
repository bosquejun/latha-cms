# @kon10/registry

The Kon10 [shadcn registry](https://ui.shadcn.com/docs/registry) — the source of
the distributable template pieces developers install into their own content
sites. Private (not published to npm); it builds a folder of static JSON that is
deployed to a host and consumed with the `shadcn` CLI.

## Layout

```
registry.json        Source index: the authored items (files referenced by path)
items/               Item source files, namespaced by framework
  tanstack/lib/kon10.ts
src/                 The build (schema + generator), the only compiled code
public/r/            Build output (gitignored) — the hosted JSON
  tanstack/kon10-client.json
  index.json         Flat catalog of every item, for discovery
```

Each item declares a `framework` (our own metadata) so its output lands under
`r/<framework>/…`. React frameworks (TanStack, Next) share this registry; Vue
gets a parallel `vue/*` namespace (shadcn-vue format) when that track lands.

## Build

```bash
pnpm --filter @kon10/registry build
```

`build` compiles `src/` and runs the generator, which reads `registry.json`,
inlines each item's file contents, validates the result against the
registry-item shape, and writes `public/r/<framework>/<name>.json` plus
`public/r/index.json`. A malformed item fails the build.

## Host

Deploy `public/` to any static host (or fold it into a docs deploy). The item
URLs are then `https://<host>/r/<framework>/<name>.json`.

## Consume

```bash
npx shadcn@latest add https://<host>/r/tanstack/kon10-client.json
```

This copies the item's files into the consumer's repo and installs its npm
`dependencies` — the dev owns the resulting source.

## Add an item

1. Drop the source files under `items/<framework>/…`.
2. Add an entry to `registry.json` with its `framework`, `name`, `type`,
   `dependencies`, `registryDependencies`, and `files` (each with a `target`).
3. Run the build and commit — `public/` regenerates on every build.

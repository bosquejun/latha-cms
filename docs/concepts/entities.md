# Entities — the content model

An **entity** is a content type you declare in `kon10.config.ts`, inside a
module (almost always `ContentModule`). Every entity is one of three **kinds**.
The kind decides its API surface, its Studio view, and how it is routed.

```ts
import { ContentModule, Collection, Document, Taxonomy, text } from '@kon10/content'

ContentModule({
  entities: [
    Document({ slug: 'site-settings', fields: { site_name: text({ required: true }) } }),
    Collection({ slug: 'posts', fields: { title: text({ required: true }) } }),
    Taxonomy({ slug: 'categories', hierarchical: true }),
  ],
})
```

---

## The three kinds

| Kind | Shape | Studio view | Use it for |
|---|---|---|---|
| **`Collection`** | Many records, full CRUD | List → create → edit | Anything an editor manages as a list: posts, pages, products |
| **`Document`** | A single instance (singleton) | Edit form only | Structural config: site-settings, nav, theme |
| **`Taxonomy`** | Hierarchical or flat grouping | Tree manager | Classification: categories, tags |

**Rule of thumb.** Reach for `Document` *only* for structural, one-of-a-kind
config. If an editor thinks of it as "a list of things" — even 2–3 things — use
`Collection`.

---

## Anatomy of an entity

```ts
import { Collection, text, select } from '@kon10/content'

Collection({
  slug: 'posts',                       // unique id; drives URLs and tables
  studio: {                            // Studio-only hints
    useAsTitle: 'title',
    defaultColumns: ['title', 'status'],
  },
  access: {                            // per-operation permission fns
    read:   () => true,
    create: ({ user }) => !!user,
    update: ({ user }) => !!user,
    delete: ({ user }) => user?.role === 'admin',
  },
  hooks: {                             // lifecycle callbacks
    beforeCreate: [ ({ data }) => ({ ...data, slug: slugify(data.title) }) ],
  },
  fields: {                            // a record of field builders
    title:  text({ required: true }),
    status: select({ options: z.enum(['draft', 'published']) }),
  },
})
```

- **`slug`** — the entity's identity. It appears in Studio URLs and (for
  collections/documents) backs the generated table.
- **`fields`** — compiled to a Zod schema at init (`buildZodSchema`), which is
  the single validation layer for the API, the Studio form, and TypeScript
  inference. See [Field Types](../../SPEC.md#field-types).
- **`access`** — pure functions evaluated on every operation. Deny by throwing;
  the RPC dispatcher surfaces the failure to the client.
- **`hooks`** — `beforeCreate` / `afterUpdate` / … run inside each operation.
- **`studio`** — presentation hints only (title field, columns, sidebar
  placement). Never affects data or access.

---

## How a kind becomes a route and a descriptor

Every entity is exposed to the Studio through the RPC layer as a serializable
**`EntityDescriptor`** (`slug`, `kind`, `label`, `fields`, …). The Studio derives
the sidebar and the correct view purely from the descriptor's `kind`:

```
collection → /studio/content/<slug>      (list, create, edit)
document   → /studio/documents/<slug>     (singleton edit form)
taxonomy   → /studio/taxonomy/<slug>      (tree manager)
```

Four route templates — **list, create, edit, singleton** — plus the taxonomy
manager cover every entity. Nothing per-entity is hand-written; the descriptor
drives it all. (See [Studio UI Routes](../../SPEC.md#studio-ui-routes-tanstack-router).)

---

## Where entities come from

Entities are contributed by **modules**, not just `ContentModule`. For example,
`UsersModule` contributes a `users` collection. The running instance exposes the
merged set via `kon10.entities` / `kon10.getEntity(slug)`, and the RPC `nav` and
`entity` actions read from there. This is why adding a module can add Studio
screens with no extra wiring.

# Recipe: webhooks from lifecycle hooks

Kon10 doesn't ship a webhook module yet (`@kon10/webhooks` is on the roadmap),
but the hook engine already gives you everything needed to notify an external
system when content changes — the classic use case being a static-site rebuild
when a post is published.

Hooks run server-side inside the operation, after access checks and
validation. `afterCreate` / `afterUpdate` / `afterDelete` fire once the write
has hit the database.

```ts
// kon10.config.ts
Collection({
  slug: 'posts',
  fields: {
    title: text({ required: true }),
    body: richtext(),
  },
  hooks: {
    afterCreate: [notifyDeploy],
    afterUpdate: [notifyDeploy],
    afterDelete: [notifyDeploy],
  },
})
```

```ts
// A fire-and-forget POST — never let a slow webhook fail the write itself.
async function notifyDeploy({ slug, doc }: { slug: string; doc?: Record<string, unknown> }) {
  const url = process.env.DEPLOY_HOOK_URL
  if (!url) return doc

  // Deliberately not awaited-and-thrown: log failures instead of failing
  // the editor's save.
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'content.changed', entity: slug, id: doc?.id }),
  }).catch((err) => console.warn('[webhook] delivery failed:', err))

  return doc
}
```

Notes:

- **Return the doc.** Hooks are transformers — each receives the previous
  hook's output and must return the document.
- **Don't block the write.** If the webhook target is down, editors shouldn't
  see save errors. Fire-and-forget (as above) or queue externally.
- **Debounce on the receiving end.** Vercel/Netlify deploy hooks already
  coalesce rapid calls; if yours doesn't, debounce there rather than in the
  hook.
- **Secrets stay server-side.** Hooks run on the server, so `DEPLOY_HOOK_URL`
  can be a secret-bearing URL.

The same pattern works for search-index updates (push to Algolia/Meilisearch
in `afterUpdate`), cache purges, or Slack notifications.

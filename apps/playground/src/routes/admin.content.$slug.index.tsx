import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@latha/ui'
import { CollectionList } from '@latha/admin-sdk'
import type { AdminEntity } from '@latha/admin-sdk'
import { deleteDoc, listDocs } from '../server/content'
import { getEntitySchema } from '../server/admin'

export const Route = createFileRoute('/admin/content/$slug/')({
  loader: async ({ params }) => {
    const [{ entity }, rows] = await Promise.all([
      getEntitySchema({ data: params.slug }),
      listDocs({ data: { collection: params.slug } }),
    ])
    return { entity: entity as unknown as AdminEntity | null, rows }
  },
  component: ListPage,
})

function ListPage() {
  const { entity, rows } = Route.useLoaderData()
  const { slug } = Route.useParams()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!entity) return <p className="text-sm text-muted-foreground">Unknown collection.</p>

  async function onDelete(id: string) {
    setBusy(true)
    try {
      await deleteDoc({ data: { collection: slug, id } })
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{entity.label}</h2>
        <Button asChild size="sm">
          <Link to="/admin/content/$slug/new" params={{ slug }}>
            New
          </Link>
        </Button>
      </div>

      <CollectionList
        entity={entity}
        rows={rows}
        getEditHref={(id) => `/admin/content/${slug}/${id}`}
        onDelete={onDelete}
        busy={busy}
      />
    </div>
  )
}

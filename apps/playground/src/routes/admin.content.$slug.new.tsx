import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CollectionForm } from '@latha/admin-sdk'
import type { AdminEntity } from '@latha/admin-sdk'
import { createDoc } from '../server/content'
import { getEntitySchema } from '../server/admin'

export const Route = createFileRoute('/admin/content/$slug/new')({
  loader: async ({ params }) => {
    const { entity } = await getEntitySchema({ data: params.slug })
    return { entity: entity as unknown as AdminEntity | null }
  },
  component: NewPage,
})

function NewPage() {
  const { entity } = Route.useLoaderData()
  const { slug } = Route.useParams()
  const navigate = useNavigate()

  if (!entity) return <p className="text-sm text-muted-foreground">Unknown collection.</p>

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold">New {entity.label}</h2>
      <CollectionForm
        entity={entity}
        onSubmit={async (values) => {
          await createDoc({ data: { collection: slug, data: values } })
          await navigate({ to: '/admin/content/$slug', params: { slug } })
        }}
        onCancel={() => navigate({ to: '/admin/content/$slug', params: { slug } })}
      />
    </div>
  )
}

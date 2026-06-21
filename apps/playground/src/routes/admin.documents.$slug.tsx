import { createFileRoute, useRouter } from '@tanstack/react-router'
import { DocumentForm } from '@latha/admin-sdk'
import type { AdminEntity } from '@latha/admin-sdk'
import { getGlobal, saveGlobal } from '../server/content'
import { getEntitySchema } from '../server/admin'

export const Route = createFileRoute('/admin/documents/$slug')({
  loader: async ({ params }) => {
    const [{ entity }, value] = await Promise.all([
      getEntitySchema({ data: params.slug }),
      getGlobal({ data: params.slug }),
    ])
    return { entity: entity as unknown as AdminEntity | null, value }
  },
  component: DocumentPage,
})

function DocumentPage() {
  const { entity, value } = Route.useLoaderData()
  const router = useRouter()

  if (!entity) return <p className="text-sm text-muted-foreground">Unknown document.</p>

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">{entity.label}</h2>
        <p className="text-sm text-muted-foreground">
          A document singleton — exactly one record.
        </p>
      </div>

      <DocumentForm
        entity={entity}
        value={value}
        onSubmit={async (values) => {
          await saveGlobal({ data: { slug: entity.slug, data: values } })
          await router.invalidate()
        }}
      />
    </div>
  )
}

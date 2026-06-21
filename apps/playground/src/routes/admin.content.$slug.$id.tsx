import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@latha/ui'
import { CollectionForm } from '@latha/admin-sdk'
import type { AdminEntity } from '@latha/admin-sdk'
import { deleteDoc, getDoc, updateDoc } from '../server/content'
import { getEntitySchema } from '../server/admin'

export const Route = createFileRoute('/admin/content/$slug/$id')({
  loader: async ({ params }) => {
    const [{ entity }, doc] = await Promise.all([
      getEntitySchema({ data: params.slug }),
      getDoc({ data: { collection: params.slug, id: params.id } }),
    ])
    return { entity: entity as unknown as AdminEntity | null, doc }
  },
  component: EditPage,
})

function EditPage() {
  const { entity, doc } = Route.useLoaderData()
  const { slug, id } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()

  if (!entity) return <p className="text-sm text-muted-foreground">Unknown collection.</p>
  if (!doc) return <p className="text-sm text-muted-foreground">Record not found.</p>

  const toList = () => navigate({ to: '/admin/content/$slug', params: { slug } })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Edit {entity.label}</h2>
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            await deleteDoc({ data: { collection: slug, id } })
            await router.invalidate()
            await toList()
          }}
        >
          Delete
        </Button>
      </div>

      <CollectionForm
        entity={entity}
        initialValues={doc}
        onSubmit={async (values) => {
          await updateDoc({ data: { collection: slug, id, data: values } })
          await toList()
        }}
        onCancel={toList}
      />
    </div>
  )
}

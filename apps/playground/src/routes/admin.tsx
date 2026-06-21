import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { AdminShell } from '@latha/admin-sdk'
import type { SidebarLinkProps } from '@latha/admin-sdk'
import { Button } from '@latha/ui'
import { getNav } from '../server/admin'
import { getCurrentUser, logoutFn } from '../server/auth'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: () => getNav(),
  component: AdminLayout,
})

/** Adapt TanStack Router's Link to the SDK's plain-href Link contract. */
function RouterLink({ href, className, children }: SidebarLinkProps) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

function AdminLayout() {
  const nav = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const router = useRouter()
  const navigate = useNavigate()

  async function onLogout() {
    await logoutFn()
    await router.invalidate()
    await navigate({ to: '/login' })
  }

  return (
    <AdminShell
      nav={nav}
      title="LathaCMS Admin"
      currentPath={pathname}
      LinkComponent={RouterLink}
      actions={
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      }
    >
      <Outlet />
    </AdminShell>
  )
}

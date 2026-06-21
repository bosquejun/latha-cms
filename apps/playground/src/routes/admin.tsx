import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { AdminShell } from '@latha/admin-sdk'
import type { SidebarLinkProps } from '@latha/admin-sdk'
import { getNav } from '../server/admin'

export const Route = createFileRoute('/admin')({
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
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <AdminShell
      nav={nav}
      title="LathaCMS Admin"
      currentPath={pathname}
      LinkComponent={RouterLink}
    >
      <Outlet />
    </AdminShell>
  )
}

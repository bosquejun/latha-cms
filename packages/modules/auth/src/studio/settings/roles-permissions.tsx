/**
 * Roles & Permissions — the Strapi-style access matrix (client-aware).
 *
 * Lives in @kon10/auth and is registered as a settings extension via the
 * @kon10/auth/studio barrel.
 *
 * Left: the role list with description and permission count.
 * Right: the selected role's permission matrix — rows = scopes (grouped by
 * module), columns = read/create/update/delete — plus the `studio:access` and
 * superadmin (`*`) toggles. Includes column/module bulk-select, scope search,
 * and a confirmation modal for destructive actions.
 *
 * Selection is URL-driven (`/settings/roles/<id>`), which makes roles
 * deep-linkable and gives phones a real master-detail flow: without a role
 * param the list is the page; with one, the detail is the page with a back
 * button (desktop always shows both panes, defaulting to the first role).
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Input,
  Skeleton,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  cn,
  toast,
} from '@kon10/ui'
import {
  EmptyState,
  PageHeader,
  PageLayout,
  defineSettingsConfig,
  useKon10,
  useStudioNavigate,
  useAsync,
  type JsonDoc,
  type PageComponentProps,
} from '@kon10/studio-sdk'
import {
  ChevronDown,
  ChevronLeft,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'

const ACTION_COLUMNS = ['read', 'create', 'update', 'delete'] as const
type Action = (typeof ACTION_COLUMNS)[number]

const SUPERADMIN_KEY = '*'
const STUDIO_ACCESS_KEY = 'studio:access'
const NON_MATRIX_SCOPES = new Set([SUPERADMIN_KEY, 'studio', 'scopes'])

interface PermLite {
  id: string
  key: string
  scope: string
  action: string
}
interface ScopeLite {
  key: string
  label: string
  module: string
}
interface ModuleState {
  perms: PermLite[]
  checkedCount: number
  allChecked: boolean
  someChecked: boolean
}
interface ColumnState {
  perms: PermLite[]
  checkedCount: number
  allChecked: boolean
  someChecked: boolean
}

const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')
const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

export const config = defineSettingsConfig({
  path: 'roles',
  label: 'Roles & Permissions',
  description: 'Define what each role can do across every module.',
  icon: ShieldCheck,
})

// ─── Primitive sub-components ─────────────────────────────────────────────────

/** Checkbox with native indeterminate state support. */
function BulkCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  className,
}: {
  checked: boolean
  indeterminate: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  }, [checked, indeterminate])

  return (
    <span
      className={cn(
        'relative inline-flex size-4 shrink-0 items-center justify-center',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'size-4 cursor-pointer appearance-none rounded-[4px] border shadow-2xs outline-none transition-colors',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed',
          checked || indeterminate
            ? 'border-primary bg-primary'
            : 'border-input bg-background',
        )}
      />
      {checked && (
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="pointer-events-none absolute size-3 text-white"
        >
          <polyline
            points="1.5,6 4.5,9 10.5,3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {!checked && indeterminate && (
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="pointer-events-none absolute size-3 text-white"
        >
          <line
            x1="2"
            y1="6"
            x2="10"
            y2="6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  )
}

/** Sidebar role item — name + description + permission count. */
function RoleItem({
  role,
  selected,
  onClick,
}: {
  role: JsonDoc
  selected: boolean
  onClick: () => void
}) {
  const name = asStr(role.label) || asStr(role.name)
  const description = asStr(role.description)
  const permCount = asIds(role.permissions).length

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-group rounded-md px-group py-group text-left transition-colors',
        selected
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent/50',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-tight">
          <span className="truncate text-small font-medium">{name}</span>
          {role.system ? (
            <Lock className="size-3 shrink-0 text-muted-foreground" />
          ) : null}
        </div>
        {description ? (
          <p className="truncate text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
        {permCount}
      </Badge>
    </button>
  )
}

/** Toggle row inside the special-permissions card. */
function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
  danger,
}: {
  icon?: React.ReactNode
  title: string
  description: string
  checked: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-card-gap p-card-gap',
        danger && checked && 'bg-warning/5',
      )}
    >
      <div className="flex items-start gap-group">
        {icon && (
          <div
            className={cn(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
              danger && checked ? 'bg-warning/15' : 'bg-muted',
            )}
          >
            {icon}
          </div>
        )}
        <div>
          <p
            className={cn(
              'text-small font-medium',
              danger && checked && 'text-warning-foreground',
            )}
          >
            {title}
          </p>
          <p className="text-caption text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RolesPermissions({ params }: PageComponentProps) {
  const { client, basePath } = useKon10()
  const navigate = useStudioNavigate()
  const roles = useAsync(() => client.list('roles'), [])
  const scopes = useAsync(() => client.list('scopes'), [])
  const permissions = useAsync(() => client.list('permissions'), [])

  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [filterQuery, setFilterQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<JsonDoc | null>(null)
  const [pendingNav, setPendingNav] = useState<string | null>(null)

  // The URL is the source of truth for selection: `/settings/roles/<id>`.
  // Without a param, desktop's two-pane view falls back to the first role
  // while the phone layout shows only the list (`detailOpen` gates panes).
  const rootHref = `${basePath}/settings/roles`
  const paramId = params[0] ?? null
  const roleList = roles.data ?? []
  const selected = (paramId ? roleList.find((r) => r.id === paramId) : null) ?? roleList[0] ?? null
  const detailOpen = paramId !== null

  useEffect(() => {
    if (selected) setChecked(new Set(asIds(selected.permissions)))
  }, [selected?.id, roles.data])

  const permByKey = useMemo(() => {
    const map = new Map<string, PermLite>()
    for (const p of permissions.data ?? []) {
      map.set(asStr(p.key), {
        id: p.id,
        key: asStr(p.key),
        scope: asStr(p.scope),
        action: asStr(p.action),
      })
    }
    return map
  }, [permissions.data])

  const scopeRows = useMemo<ScopeLite[]>(() => {
    const rows = (scopes.data ?? [])
      .map((s) => ({ key: asStr(s.key), label: asStr(s.label), module: asStr(s.module) }))
      .filter((s) => !NON_MATRIX_SCOPES.has(s.key))
    rows.sort((a, b) => a.module.localeCompare(b.module) || a.key.localeCompare(b.key))
    return rows
  }, [scopes.data])

  const moduleGroups = useMemo<Array<[string, ScopeLite[]]>>(() => {
    const groups = new Map<string, ScopeLite[]>()
    for (const row of scopeRows) {
      const list = groups.get(row.module) ?? []
      list.push(row)
      groups.set(row.module, list)
    }
    return [...groups.entries()]
  }, [scopeRows])

  const filteredModuleGroups = useMemo<Array<[string, ScopeLite[]]>>(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return moduleGroups
    return moduleGroups
      .map(([mod, rows]): [string, ScopeLite[]] => [
        mod,
        rows.filter(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            s.key.toLowerCase().includes(q) ||
            mod.toLowerCase().includes(q),
        ),
      ])
      .filter(([, rows]) => rows.length > 0)
  }, [moduleGroups, filterQuery])

  const moduleState = useMemo<Map<string, ModuleState>>(() => {
    return new Map(
      moduleGroups.map(([mod, rows]) => {
        const perms = rows.flatMap((s) =>
          ACTION_COLUMNS.map((a) => permByKey.get(`${s.key}:${a}`)).filter(
            (p): p is PermLite => Boolean(p),
          ),
        )
        const checkedCount = perms.filter((p) => checked.has(p.id)).length
        return [
          mod,
          {
            perms,
            checkedCount,
            allChecked: perms.length > 0 && checkedCount === perms.length,
            someChecked: checkedCount > 0 && checkedCount < perms.length,
          },
        ]
      }),
    )
  }, [moduleGroups, permByKey, checked])

  const columnState = useMemo<Record<Action, ColumnState>>(
    () =>
      Object.fromEntries(
        ACTION_COLUMNS.map((action) => {
          const perms = scopeRows
            .map((s) => permByKey.get(`${s.key}:${action}`))
            .filter((p): p is PermLite => Boolean(p))
          const checkedCount = perms.filter((p) => checked.has(p.id)).length
          return [
            action,
            {
              perms,
              checkedCount,
              allChecked: perms.length > 0 && checkedCount === perms.length,
              someChecked: checkedCount > 0 && checkedCount < perms.length,
            },
          ]
        }),
      ) as Record<Action, ColumnState>,
    [scopeRows, permByKey, checked],
  )

  const superId = permByKey.get(SUPERADMIN_KEY)?.id
  const studioAccessId = permByKey.get(STUDIO_ACCESS_KEY)?.id
  const isSuper = superId ? checked.has(superId) : false

  const original = useMemo(
    () => new Set(asIds(selected?.permissions)),
    [selected?.id, roles.data],
  )
  const dirty =
    checked.size !== original.size || [...checked].some((id) => !original.has(id))

  const toggle = (id: string | undefined, on?: boolean) => {
    if (!id) return
    setChecked((prev) => {
      const next = new Set(prev)
      const value = on ?? !next.has(id)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleColumn = (action: Action, on: boolean) => {
    const perms = columnState[action].perms
    setChecked((prev) => {
      const next = new Set(prev)
      for (const p of perms) on ? next.add(p.id) : next.delete(p.id)
      return next
    })
  }

  const toggleModulePerms = (mod: string, on: boolean) => {
    const state = moduleState.get(mod)
    if (!state) return
    setChecked((prev) => {
      const next = new Set(prev)
      for (const p of state.perms) on ? next.add(p.id) : next.delete(p.id)
      return next
    })
  }

  const toggleSection = (mod: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(mod) ? next.delete(mod) : next.add(mod)
      return next
    })

  const go = (href: string) => {
    if (dirty) setPendingNav(href)
    else navigate(href)
  }

  // Select a role → its URL. Re-selecting the current role (e.g. tapping it
  // from the mobile list before any param is set) never risks data loss, so
  // it navigates without the guard.
  const trySelectRole = (id: string) => {
    const href = `${rootHref}/${id}`
    if (id === selected?.id) navigate(href)
    else go(href)
  }

  const loading = roles.loading || scopes.loading || permissions.loading

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await client.update('roles', selected.id, { permissions: [...checked] })
      toast.success('Permissions saved.')
      await roles.reload()
    } finally {
      setSaving(false)
    }
  }

  const createRole = async () => {
    const name = newName.trim()
    if (!name) return
    const created = await client.create('roles', {
      name,
      label: name,
      permissions: [],
      system: false,
    })
    setNewName('')
    setCreating(false)
    toast.success('Role created.')
    await roles.reload()
    navigate(`${rootHref}/${created.id}`)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await client.remove('roles', pendingDelete.id)
    setPendingDelete(null)
    toast.success('Role deleted.')
    await roles.reload()
    navigate(rootHref)
  }

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Define what each role can do. Public applies to anonymous requests; Authenticated is the baseline for every logged-in user."
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete role"
        description={
          pendingDelete && (
            <>
              Delete{' '}
              <strong>
                {asStr(pendingDelete.label) || asStr(pendingDelete.name)}
              </strong>
              ? This cannot be undone and will remove the role from all users
              assigned to it.
            </>
          )
        }
        confirmLabel="Delete role"
        destructive
        onConfirm={() => void confirmDelete()}
      />

      {/* Unsaved-changes guard when navigating away from a dirty role */}
      <ConfirmDialog
        open={pendingNav !== null}
        onOpenChange={(open) => !open && setPendingNav(null)}
        title="Discard unsaved changes?"
        description="You have unsaved permission changes for this role. Switching away will discard them."
        confirmLabel="Discard & switch"
        onConfirm={() => {
          if (pendingNav) {
            navigate(pendingNav)
            setPendingNav(null)
          }
        }}
      />

      {loading ? (
        <PageLayout
          left={
            <Card className="p-inline">
              <div className="flex flex-col gap-stack">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-group px-group py-group">
                    <div className="flex-1 space-y-tight">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                    <Skeleton className="h-4 w-7 rounded" />
                  </div>
                ))}
              </div>
            </Card>
          }
        >
          <div className="flex flex-col gap-card-gap">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </PageLayout>
      ) : (
        <PageLayout
          left={
            /* On phones the list *is* the page when no role param is set;
               opening a role hides it in favour of the detail subpage. */
            <div className={cn('flex flex-col gap-inline', detailOpen && 'max-lg:hidden')}>
            <div className="flex items-center justify-between px-stack">
              <div className="flex items-center gap-inline">
                <span className="text-small font-semibold text-foreground">
                  Roles
                </span>
                <Badge variant="secondary">{roleList.length}</Badge>
              </div>
              {!creating && (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus /> New role
                </Button>
              )}
            </div>

            <Card className="p-inline">
              {roleList.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {roleList.map((role) => (
                    <RoleItem
                      key={role.id}
                      role={role}
                      selected={selected?.id === role.id}
                      onClick={() => trySelectRole(role.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-group py-card-gap text-center text-small text-muted-foreground">
                  No roles yet.
                </p>
              )}
            </Card>

            {creating && (
              <Card className="p-group">
                <p className="mb-inline text-small font-medium">New role</p>
                <div className="flex flex-col gap-inline">
                  <Input
                    autoFocus
                    placeholder="Role name (e.g. author)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void createRole()}
                  />
                  <div className="flex gap-inline">
                    <Button
                      size="sm"
                      onClick={() => void createRole()}
                      disabled={!newName.trim()}
                    >
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCreating(false)
                        setNewName('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            </div>
          }
        >
          {/* ── Matrix panel ─────────────────────────────────────────────── */}
          {selected ? (
            <div
              className={cn(
                'flex min-w-0 flex-col gap-card-gap',
                // On phones the detail is a subpage — hidden until a role
                // param is in the URL, entered from the list.
                !detailOpen && 'max-lg:hidden',
              )}
            >
              {/* Back to the role list — phones only, where the list is a
                  separate page. Guarded like any other dirty navigation. */}
              <button
                type="button"
                onClick={() => go(rootHref)}
                className="flex items-center gap-1 self-start rounded-md py-1 pr-2 text-small font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden pointer-coarse:min-h-10"
              >
                <ChevronLeft className="size-4" /> All roles
              </button>

              <div className="flex flex-wrap items-start justify-between gap-card-gap">
                <div>
                  <div>
                    <div className="flex flex-wrap items-center gap-inline">
                      <h2 className="text-base font-semibold">
                        {asStr(selected.label) || asStr(selected.name)}
                      </h2>
                      {selected.system ? (
                        <Badge variant="secondary">
                          <Lock className="size-3" /> System
                        </Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </div>
                    {asStr(selected.description) ? (
                      <p className="text-small text-muted-foreground">
                        {asStr(selected.description)}
                      </p>
                    ) : null}
                    <p className="text-caption text-muted-foreground">
                      {checked.size} permission
                      {checked.size !== 1 ? 's' : ''} granted
                      {dirty && (
                        <span className="ml-tight font-medium text-warning-foreground">
                          · Unsaved changes
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-inline">
                  {!selected.system && (
                    <Button
                      size="sm"
                      variant="destructive-subtle"
                      onClick={() => setPendingDelete(selected)}
                    >
                      <Trash2 /> Delete
                    </Button>
                  )}
                  <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>

              <Card
                className={cn(
                  'divide-y divide-border overflow-hidden p-0',
                  isSuper && 'ring-1 ring-warning/50',
                )}
              >
                <ToggleRow
                  icon={
                    <TriangleAlert
                      className={cn(
                        'size-4',
                        isSuper
                          ? 'text-warning-foreground'
                          : 'text-muted-foreground',
                      )}
                    />
                  }
                  title="Superadmin — unrestricted access"
                  description="Bypasses all permission checks. Grant only to highly trusted administrators; overrides the matrix below."
                  checked={isSuper}
                  onChange={(on) => toggle(superId, on)}
                  disabled={!superId}
                  danger
                />
                <ToggleRow
                  icon={<ShieldCheck className="size-4 text-muted-foreground" />}
                  title="Access the Studio"
                  description="Required to sign in to the Studio. Leave off for Public and API-only roles."
                  checked={studioAccessId ? checked.has(studioAccessId) : false}
                  onChange={(on) => toggle(studioAccessId, on)}
                  disabled={!studioAccessId || isSuper}
                />
              </Card>

              <Card
                className={cn(
                  'overflow-hidden p-0',
                  isSuper && 'pointer-events-none opacity-40',
                )}
              >
                <div className="border-b border-border p-group">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter permissions…"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {filterQuery && (
                      <button
                        type="button"
                        onClick={() => setFilterQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Clear filter"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                <Table>
                  <THead>
                    {/* Row 1 — column labels, aligned on the same baseline */}
                    <TR className="border-b-0">
                      <TH className="max-sm:px-3">Resource</TH>
                      {/* Compact action columns on phones so all four fit
                          without sideways panning. */}
                      {ACTION_COLUMNS.map((action) => (
                        <TH
                          key={action}
                          className="min-w-12 px-2 text-center capitalize sm:min-w-[80px] sm:px-4"
                        >
                          {action}
                        </TH>
                      ))}
                    </TR>
                    {/* Row 2 — bulk-select checkboxes */}
                    <TR>
                      <TH className="py-group font-normal text-muted-foreground max-sm:px-3">
                        Select all
                      </TH>
                      {ACTION_COLUMNS.map((action) => (
                        <TH key={action} className="px-2 py-group text-center sm:px-4">
                          <div className="flex items-center justify-center">
                            <BulkCheckbox
                              checked={columnState[action].allChecked}
                              indeterminate={columnState[action].someChecked}
                              onChange={(on) => toggleColumn(action, on)}
                              disabled={isSuper}
                            />
                          </div>
                        </TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {filteredModuleGroups.length === 0 ? (
                      <TR>
                        <TD
                          colSpan={1 + ACTION_COLUMNS.length}
                          className="py-10 text-center text-small text-muted-foreground"
                        >
                          No permissions match &ldquo;{filterQuery}&rdquo;
                        </TD>
                      </TR>
                    ) : (
                      filteredModuleGroups.map(([mod, rows]) => {
                        const open = !collapsed.has(mod)
                        const modSt = moduleState.get(mod)
                        return (
                          <Fragment key={mod}>
                            <TR className="bg-muted/30 hover:bg-muted/40">
                              <TD
                                colSpan={1 + ACTION_COLUMNS.length}
                                className="py-inline max-sm:px-3"
                              >
                                <div className="flex items-center gap-inline">
                                  <button
                                    type="button"
                                    onClick={() => toggleSection(mod)}
                                    className="flex flex-1 items-center gap-inline text-small font-medium capitalize"
                                  >
                                    <ChevronDown
                                      className={cn(
                                        'size-4 text-muted-foreground transition-transform',
                                        !open && '-rotate-90',
                                      )}
                                    />
                                    {mod || 'Other'}
                                  </button>
                                  {modSt && (
                                    <span className="text-caption text-muted-foreground">
                                      {modSt.checkedCount}/{modSt.perms.length}
                                    </span>
                                  )}
                                  {modSt && (
                                    <BulkCheckbox
                                      checked={modSt.allChecked}
                                      indeterminate={modSt.someChecked}
                                      onChange={(on) =>
                                        toggleModulePerms(mod, on)
                                      }
                                      disabled={isSuper}
                                    />
                                  )}
                                </div>
                              </TD>
                            </TR>

                            {open &&
                              rows.map((scope) => (
                                <TR
                                  key={scope.key}
                                  className="hover:bg-accent/20"
                                >
                                  <TD className="max-sm:px-3">
                                    <span className="text-small font-medium">
                                      {scope.label || scope.key}
                                    </span>
                                    {scope.label && scope.label.toLowerCase() !== scope.key.toLowerCase() && (
                                      <span className="ml-tight text-caption text-muted-foreground max-sm:hidden">
                                        {scope.key}
                                      </span>
                                    )}
                                  </TD>
                                  {ACTION_COLUMNS.map((action) => {
                                    const perm = permByKey.get(
                                      `${scope.key}:${action}`,
                                    )
                                    return (
                                      <TD key={action} className="px-2 text-center sm:px-4">
                                        {perm ? (
                                          <Checkbox
                                            checked={
                                              isSuper || checked.has(perm.id)
                                            }
                                            disabled={isSuper}
                                            onChange={() => toggle(perm.id)}
                                          />
                                        ) : (
                                          <span className="inline-flex size-4 items-center justify-center text-muted-foreground/30">
                                            —
                                          </span>
                                        )}
                                      </TD>
                                    )
                                  })}
                                </TR>
                              ))}
                          </Fragment>
                        )
                      })
                    )}
                  </TBody>
                </Table>
              </Card>
            </div>
          ) : (
            /* Empty state — no roles exist. On phones the list card already
               says so, so this desktop-pane echo stays hidden there. */
            <div className="max-lg:hidden">
              <EmptyState
                icon={ShieldAlert}
                title="No roles yet"
                description="Create your first role to start managing who can do what across your content."
                action={
                  <Button size="sm" className="mt-stack" onClick={() => setCreating(true)}>
                    <Plus /> Create a role
                  </Button>
                }
              />
            </div>
          )}
        </PageLayout>
      )}
    </>
  )
}

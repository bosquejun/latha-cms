/**
 * Roles & Permissions — the Strapi-style access matrix (client-aware).
 *
 * Lives in @latha/auth and is registered as a settings extension via the
 * @latha/auth/admin barrel. Migrated from @latha/start.
 *
 * Left: the role list with description and permission count.
 * Right: the selected role's permission matrix — rows = scopes (grouped by
 * module), columns = read/create/update/delete — plus the `admin:access` and
 * superadmin (`*`) toggles. Includes column/module bulk-select, scope search,
 * and a confirmation modal for destructive actions.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  cn,
} from '@latha/ui'
import {
  PageHeader,
  defineSettingsConfig,
  useLatha,
  useAsync,
  type JsonDoc,
} from '@latha/admin-sdk'
import {
  ChevronDown,
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
const ADMIN_ACCESS_KEY = 'admin:access'
const NON_MATRIX_SCOPES = new Set([SUPERADMIN_KEY, 'admin', 'scopes'])


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

/** Inline confirmation dialog rendered over a dark overlay. */
function ConfirmModal({
  icon,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'default',
  onConfirm,
  onCancel,
}: {
  icon?: React.ReactNode
  title: string
  description: React.ReactNode
  confirmLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-page">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <Card className="relative z-10 w-full max-w-sm p-card shadow-2xl">
        <div className="flex flex-col gap-card-gap">
          {icon && (
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-full',
                variant === 'destructive' ? 'bg-destructive/10' : 'bg-muted',
              )}
            >
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-stack text-small text-muted-foreground">{description}</p>
          </div>
          <div className="flex justify-end gap-inline">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              size="sm"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

/** Animated skeleton block for loading states. */
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
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

export default function RolesPermissions() {
  const { client } = useLatha()
  const roles = useAsync(() => client.list('roles'), [])
  const scopes = useAsync(() => client.list('scopes'), [])
  const permissions = useAsync(() => client.list('permissions'), [])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [filterQuery, setFilterQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<JsonDoc | null>(null)
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null)

  const roleList = roles.data ?? []
  const selected = roleList.find((r) => r.id === selectedId) ?? roleList[0] ?? null

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

  // Scope rows filtered by the search query
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

  // Permission states per module (unfiltered — for bulk selects)
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

  // Permission states per action column (unfiltered)
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
  const adminAccessId = permByKey.get(ADMIN_ACCESS_KEY)?.id
  const isSuper = superId ? checked.has(superId) : false

  const original = useMemo(
    () => new Set(asIds(selected?.permissions)),
    [selected?.id, roles.data],
  )
  const dirty =
    checked.size !== original.size || [...checked].some((id) => !original.has(id))

  // Toggle a single permission
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

  // Bulk-toggle all permissions in an action column
  const toggleColumn = (action: Action, on: boolean) => {
    const perms = columnState[action].perms
    setChecked((prev) => {
      const next = new Set(prev)
      for (const p of perms) on ? next.add(p.id) : next.delete(p.id)
      return next
    })
  }

  // Bulk-toggle all permissions in a module group
  const toggleModulePerms = (mod: string, on: boolean) => {
    const state = moduleState.get(mod)
    if (!state) return
    setChecked((prev) => {
      const next = new Set(prev)
      for (const p of state.perms) on ? next.add(p.id) : next.delete(p.id)
      return next
    })
  }

  // Collapse/expand a module section in the accordion
  const toggleSection = (mod: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(mod) ? next.delete(mod) : next.add(mod)
      return next
    })

  // Switch roles, prompting for confirmation when there are unsaved changes
  const trySelectRole = (id: string) => {
    if (dirty && id !== selected?.id) {
      setPendingSwitch(id)
    } else {
      setSelectedId(id)
    }
  }

  const loading = roles.loading || scopes.loading || permissions.loading

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await client.update('roles', selected.id, { permissions: [...checked] })
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
    await roles.reload()
    setSelectedId(created.id)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await client.remove('roles', pendingDelete.id)
    setPendingDelete(null)
    setSelectedId(null)
    await roles.reload()
  }

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Define what each role can do. Public applies to anonymous requests; Authenticated is the baseline for every logged-in user."
      />

      {/* Delete confirmation */}
      {pendingDelete && (
        <ConfirmModal
          variant="destructive"
          icon={<Trash2 className="size-5 text-destructive" />}
          title="Delete role"
          description={
            <>
              Delete{' '}
              <strong>
                {asStr(pendingDelete.label) || asStr(pendingDelete.name)}
              </strong>
              ? This cannot be undone and will remove the role from all users
              assigned to it.
            </>
          }
          confirmLabel="Delete role"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Unsaved-changes guard when switching roles */}
      {pendingSwitch && (
        <ConfirmModal
          title="Discard unsaved changes?"
          description="You have unsaved permission changes for this role. Switching away will discard them."
          confirmLabel="Discard & switch"
          onConfirm={() => {
            setSelectedId(pendingSwitch)
            setPendingSwitch(null)
          }}
          onCancel={() => setPendingSwitch(null)}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-page lg:grid-cols-[280px_1fr]">
          {/* Sidebar skeleton */}
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
          {/* Matrix skeleton */}
          <div className="flex flex-col gap-card-gap">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-page lg:grid-cols-[280px_1fr]">
          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-inline">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-stack">
              <div className="flex items-center gap-inline">
                <span className="text-small font-semibold text-foreground">
                  Roles
                </span>
                <Badge variant="secondary">{roleList.length}</Badge>
              </div>
              {!creating && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCreating(true)}
                >
                  <Plus /> New role
                </Button>
              )}
            </div>

            {/* Role list */}
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

            {/* Inline create form */}
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

          {/* ── Matrix panel ─────────────────────────────────────────────── */}
          {selected ? (
            <div className="flex min-w-0 flex-col gap-card-gap">
              {/* Role header */}
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
                      variant="ghost-outline"
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

              {/* Special permission toggles */}
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
                  title="Access the admin UI"
                  description="Required to sign in to the admin. Leave off for Public and API-only roles."
                  checked={adminAccessId ? checked.has(adminAccessId) : false}
                  onChange={(on) => toggle(adminAccessId, on)}
                  disabled={!adminAccessId || isSuper}
                />
              </Card>

              {/* Permission matrix */}
              <Card
                className={cn(
                  'overflow-hidden p-0',
                  isSuper && 'pointer-events-none opacity-40',
                )}
              >
                {/* Search bar */}
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
                      <TH>Resource</TH>
                      {ACTION_COLUMNS.map((action) => (
                        <TH
                          key={action}
                          className="min-w-[80px] text-center capitalize"
                        >
                          {action}
                        </TH>
                      ))}
                    </TR>
                    {/* Row 2 — bulk-select checkboxes with room to breathe */}
                    <TR>
                      <TH className="py-group font-normal text-muted-foreground">
                        Select all
                      </TH>
                      {ACTION_COLUMNS.map((action) => (
                        <TH key={action} className="py-group text-center">
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
                            {/* Module group header */}
                            <TR className="bg-muted/30 hover:bg-muted/40">
                              <TD
                                colSpan={1 + ACTION_COLUMNS.length}
                                className="py-inline"
                              >
                                <div className="flex items-center gap-inline">
                                  {/* Accordion toggle */}
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
                                  {/* Granted / total count */}
                                  {modSt && (
                                    <span className="text-caption text-muted-foreground">
                                      {modSt.checkedCount}/{modSt.perms.length}
                                    </span>
                                  )}
                                  {/* Bulk-select the whole module */}
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

                            {/* Scope rows */}
                            {open &&
                              rows.map((scope) => (
                                <TR
                                  key={scope.key}
                                  className="hover:bg-accent/20"
                                >
                                  <TD>
                                    <span className="text-small font-medium">
                                      {scope.label || scope.key}
                                    </span>
                                    {scope.label && scope.label.toLowerCase() !== scope.key.toLowerCase() && (
                                      <span className="ml-tight text-caption text-muted-foreground">
                                        {scope.key}
                                      </span>
                                    )}
                                  </TD>
                                  {ACTION_COLUMNS.map((action) => {
                                    const perm = permByKey.get(
                                      `${scope.key}:${action}`,
                                    )
                                    return (
                                      <TD key={action} className="text-center">
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
            /* Empty state — no roles exist */
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-empty text-center">
              <div className="mb-card-gap flex size-14 items-center justify-center rounded-full bg-muted">
                <ShieldAlert className="size-7 text-muted-foreground" />
              </div>
              <p className="font-semibold">No roles yet</p>
              <p className="mt-stack max-w-xs text-small text-muted-foreground">
                Create your first role to start managing who can do what across
                your content.
              </p>
              <Button
                size="sm"
                className="mt-form"
                onClick={() => setCreating(true)}
              >
                <Plus /> Create a role
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Roles & Permissions — the Strapi-style access matrix (client-aware).
 *
 * Lives in @latha/auth and is registered as a settings extension via the
 * @latha/auth/admin barrel. Migrated from @latha/start.
 *
 * Left: the role list (with a System badge and a create/delete affordance).
 * Right: the selected role's permission matrix — rows = scopes (grouped by
 * module), columns = read/create/update/delete — plus the `admin:access` and
 * superadmin (`*`) toggles. Everything is driven by the catalog the kernel
 * already syncs (`scopes`/`permissions`) and saved through the standard RPC
 * `roles` mutations, so there's no special endpoint.
 */

import { Fragment, useEffect, useMemo, useState } from 'react'
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
import { ChevronDown, Plus, ShieldCheck, Trash2 } from 'lucide-react'

const ACTION_COLUMNS = ['read', 'create', 'update', 'delete'] as const

const SUPERADMIN_KEY = '*'
const ADMIN_ACCESS_KEY = 'admin:access'

// Scopes that aren't grantable resources in the matrix: the superadmin/admin
// gates (surfaced as the toggles above), and `scopes`, which is pure catalog
// plumbing (synced from config, not user-managed).
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

const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')
const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

export const config = defineSettingsConfig({
  path: 'roles',
  label: 'Roles & Permissions',
  description: 'Define what each role can do across every module.',
  icon: ShieldCheck,
})

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

  const toggleModule = (mod: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(mod)) next.delete(mod)
      else next.add(mod)
      return next
    })

  const roleList = roles.data ?? []
  const selected = roleList.find((r) => r.id === selectedId) ?? roleList[0] ?? null

  // Sync the local matrix when the selected role (or the role data) changes.
  useEffect(() => {
    if (selected) setChecked(new Set(asIds(selected.permissions)))
  }, [selected?.id, roles.data])

  // Index the catalog: permission by key, and scope rows grouped by module.
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

  // Group the scope rows into [module, rows] sections for the accordion.
  const moduleGroups = useMemo<Array<[string, ScopeLite[]]>>(() => {
    const groups = new Map<string, ScopeLite[]>()
    for (const row of scopeRows) {
      const list = groups.get(row.module) ?? []
      list.push(row)
      groups.set(row.module, list)
    }
    return [...groups.entries()]
  }, [scopeRows])

  const superId = permByKey.get(SUPERADMIN_KEY)?.id
  const adminAccessId = permByKey.get(ADMIN_ACCESS_KEY)?.id
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

  const deleteRole = async (role: JsonDoc) => {
    if (role.system) return
    if (!confirm(`Delete the "${asStr(role.label) || asStr(role.name)}" role?`)) return
    await client.remove('roles', role.id)
    setSelectedId(null)
    await roles.reload()
  }

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Define what each role can do. Public applies to anonymous requests; Authenticated is the baseline for every logged-in user."
      />

      {loading ? (
        <p className="text-small text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {/* Role list */}
          <Card className="h-fit p-2">
            <div className="flex flex-col gap-1">
              {roleList.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedId(role.id)}
                  className={cn(
                    'flex items-center justify-between rounded-md px-3 py-2 text-left text-small transition-colors',
                    selected?.id === role.id
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'hover:bg-accent/60',
                  )}
                >
                  <span className="truncate">{asStr(role.label) || asStr(role.name)}</span>
                  {role.system ? (
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      System
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="mt-2 border-t border-border pt-2">
              {creating ? (
                <div className="flex flex-col gap-2 p-1">
                  <Input
                    autoFocus
                    placeholder="Role name (e.g. author)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void createRole()}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createRole} disabled={!newName.trim()}>
                      Create
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setCreating(true)}
                >
                  <Plus /> New role
                </Button>
              )}
            </div>
          </Card>

          {/* Matrix */}
          {selected ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    {asStr(selected.label) || asStr(selected.name)}
                  </h2>
                  {asStr(selected.description) ? (
                    <p className="text-small text-muted-foreground">
                      {asStr(selected.description)}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {!selected.system && (
                    <Button
                      size="sm"
                      variant="ghost-outline"
                      onClick={() => deleteRole(selected)}
                    >
                      <Trash2 /> Delete
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={!dirty || saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>

              {/* Special toggles */}
              <Card className="flex flex-col gap-3 p-4">
                <ToggleRow
                  icon={<ShieldCheck className="size-4 text-muted-foreground" />}
                  title="Full access (superadmin)"
                  description="Grants every permission. Overrides the matrix below."
                  checked={isSuper}
                  onChange={(on) => toggle(superId, on)}
                  disabled={!superId}
                />
                <ToggleRow
                  title="Access the admin UI"
                  description="Required to sign in to the admin. Leave off for Public / app-only roles."
                  checked={adminAccessId ? checked.has(adminAccessId) : false}
                  onChange={(on) => toggle(adminAccessId, on)}
                  disabled={!adminAccessId || isSuper}
                />
              </Card>

              {/* One matrix card; modules are collapsible group-header rows. */}
              <Card className={cn('overflow-hidden p-0', isSuper && 'opacity-50')}>
                <Table>
                  <THead>
                    <TR>
                      <TH>Resource</TH>
                      {ACTION_COLUMNS.map((a) => (
                        <TH key={a} className="text-center capitalize">
                          {a}
                        </TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {moduleGroups.map(([mod, rows]) => {
                      const open = !collapsed.has(mod)
                      return (
                        <Fragment key={mod}>
                          <TR
                            className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                            onClick={() => toggleModule(mod)}
                          >
                            <TD colSpan={1 + ACTION_COLUMNS.length} className="py-2">
                              <span className="flex items-center gap-2 text-small font-medium capitalize">
                                <ChevronDown
                                  className={cn(
                                    'size-4 text-muted-foreground transition-transform',
                                    !open && '-rotate-90',
                                  )}
                                />
                                {mod || 'Other'}
                                <span className="text-caption font-normal text-muted-foreground">
                                  {rows.length}
                                </span>
                              </span>
                            </TD>
                          </TR>
                          {open
                            ? rows.map((scope) => (
                                <TR key={scope.key}>
                                  <TD className="font-medium">
                                    {scope.label || scope.key}
                                  </TD>
                                  {ACTION_COLUMNS.map((action) => {
                                    const perm = permByKey.get(`${scope.key}:${action}`)
                                    return (
                                      <TD key={action} className="text-center">
                                        {perm ? (
                                          <Checkbox
                                            checked={isSuper || checked.has(perm.id)}
                                            disabled={isSuper}
                                            onChange={() => toggle(perm.id)}
                                          />
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TD>
                                    )
                                  })}
                                </TR>
                              ))
                            : null}
                        </Fragment>
                      )
                    })}
                  </TBody>
                </Table>
              </Card>
            </div>
          ) : (
            <p className="text-small text-muted-foreground">No roles yet.</p>
          )}
        </div>
      )}
    </>
  )
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon?: React.ReactNode
  title: string
  description: string
  checked: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <p className="text-small font-medium">{title}</p>
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

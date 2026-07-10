/**
 * API Keys — mint and revoke bearer credentials for the delivery API.
 *
 * Lives in @kon10/auth (the module that owns the `api-keys` entity) and is
 * registered as a settings extension via the @kon10/auth/studio barrel, like
 * Roles & Permissions. The generic CRUD form can't manage keys: creating one
 * means generating a secret and showing it exactly once.
 *
 * The token is generated *in the browser* (Web Crypto) and only its SHA-256
 * hash is sent through the standard create RPC — the plaintext never reaches
 * the server, and there is nothing stored that could replay it.
 */

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
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
  LoadingState,
  PageHeader,
  PageLayout,
  defineSettingsConfig,
  useKon10,
  useAsync,
  type JsonDoc,
} from '@kon10/studio-sdk'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import {
  apiKeyDisplayPrefix,
  generateApiKeyToken,
  hashApiKeyToken,
} from '../../api-keys/token.js'

// Kept as a literal (like 'roles' below) so the client bundle doesn't pull in
// the entity definition; must match API_KEYS_SLUG in api-keys/entities.ts.
const API_KEYS_SLUG = 'api-keys'

export const config = defineSettingsConfig({
  path: 'api-keys',
  label: 'API Keys',
  description: 'Bearer credentials for the public delivery API.',
  icon: KeyRound,
})

const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')
const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

function roleNames(roles: JsonDoc[] | undefined, ids: string[]): string[] {
  if (!roles) return []
  const byId = new Map(roles.map((r) => [r.id, asStr(r.name) || r.id]))
  return ids.map((id) => byId.get(id) ?? id)
}

export default function ApiKeys() {
  const { client } = useKon10()
  const keys = useAsync(() => client.list(API_KEYS_SLUG), [])
  const roles = useAsync(() => client.list('roles'), [])

  const [createOpen, setCreateOpen] = useState(false)
  const [mintedToken, setMintedToken] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<JsonDoc | null>(null)
  const [busy, setBusy] = useState(false)

  const sorted = useMemo(
    () =>
      [...(keys.data ?? [])].sort((a, b) =>
        asStr(a.createdAt) < asStr(b.createdAt) ? 1 : -1,
      ),
    [keys.data],
  )

  const toggleEnabled = async (doc: JsonDoc) => {
    await client.update(API_KEYS_SLUG, doc.id, { enabled: doc.enabled === false })
    keys.reload()
  }

  const removeKey = async (doc: JsonDoc) => {
    setBusy(true)
    try {
      await client.remove(API_KEYS_SLUG, doc.id)
      setConfirmDelete(null)
      toast.success('API key deleted.')
      keys.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="API Keys"
        description="Bearer credentials for the public delivery API. A key carries exactly the permissions of its roles."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Create key
          </Button>
        }
      />

      {keys.loading ? (
        <LoadingState />
      ) : keys.error ? (
        <Card className="p-6 text-sm text-destructive">{keys.error}</Card>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys yet"
          description="Create one to let a headless consumer read published content over /api/v1."
          action={
            <Button size="sm" className="mt-stack" onClick={() => setCreateOpen(true)}>
              <Plus /> Create key
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          {/* ── Mobile (< md): stacked cards, same pattern as EntityList ──── */}
          <ul className="divide-y divide-border md:hidden">
            {sorted.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{asStr(doc.name)}</p>
                    <code className="text-xs text-muted-foreground">
                      {asStr(doc.prefix)}…
                    </code>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={doc.enabled !== false}
                      onChange={() => void toggleEnabled(doc)}
                      aria-label={`Enable ${asStr(doc.name)}`}
                    />
                    <Button
                      variant="destructive-subtle"
                      size="icon-sm"
                      aria-label={`Delete ${asStr(doc.name)}`}
                      title="Delete"
                      onClick={() => setConfirmDelete(doc)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {asIds(doc.roles).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {roleNames(roles.data, asIds(doc.roles)).map((name) => (
                      <Badge key={name} variant="secondary">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* ── Tablet & desktop (md+) ─────────────────────────────────────── */}
          <div className="max-md:hidden">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Key</TH>
                <TH>Roles</TH>
                <TH>Enabled</TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {sorted.map((doc) => (
                <TR key={doc.id}>
                  <TD className="font-medium">{asStr(doc.name)}</TD>
                  <TD>
                    <code className="text-xs text-muted-foreground">
                      {asStr(doc.prefix)}…
                    </code>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {roleNames(roles.data, asIds(doc.roles)).map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    <Switch
                      checked={doc.enabled !== false}
                      onChange={() => void toggleEnabled(doc)}
                      aria-label={`Enable ${asStr(doc.name)}`}
                    />
                  </TD>
                  <TD>
                    <Button
                      variant="destructive-subtle"
                      size="icon-sm"
                      aria-label={`Delete ${asStr(doc.name)}`}
                      title="Delete"
                      onClick={() => setConfirmDelete(doc)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          </div>
        </Card>
      )}

      <CreateKeyDialog
        open={createOpen}
        roles={roles.data ?? []}
        onClose={() => setCreateOpen(false)}
        onCreated={(token) => {
          setCreateOpen(false)
          setMintedToken(token)
          keys.reload()
        }}
      />

      <Dialog open={mintedToken !== null} onOpenChange={(open) => !open && setMintedToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key</DialogTitle>
            <DialogDescription>
              This is the only time the key is shown — only a hash of it is
              stored. Send it as{' '}
              <code className="text-xs">Authorization: Bearer …</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
            <code className="min-w-0 flex-1 break-all text-xs">{mintedToken}</code>
            {mintedToken ? <CopyButton value={mintedToken} /> : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setMintedToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete API key"
        description={`“${asStr(confirmDelete?.name)}” stops working immediately. Consumers using it will get 401s.`}
        confirmLabel="Delete key"
        destructive
        busy={busy}
        onConfirm={() => confirmDelete && void removeKey(confirmDelete)}
      />
    </PageLayout>
  )
}

function CreateKeyDialog({
  open,
  roles,
  onClose,
  onCreated,
}: {
  open: boolean
  roles: JsonDoc[]
  onClose: () => void
  onCreated: (token: string) => void
}) {
  const { client } = useKon10()
  const [name, setName] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleRole = (id: string) =>
    setRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const token = generateApiKeyToken()
      await client.create(API_KEYS_SLUG, {
        name: name.trim(),
        keyHash: await hashApiKeyToken(token),
        prefix: apiKeyDisplayPrefix(token),
        roles: roleIds,
        enabled: true,
      })
      setName('')
      setRoleIds([])
      onCreated(token)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // The public/authenticated system roles are session concepts, not key grants,
  // but they remain selectable — an admin may deliberately mirror Public.
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            The key inherits the permissions of the roles you attach.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium">
            Name
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production website"
              autoFocus
            />
          </label>
          <div className="space-y-1.5">
            <div className="text-sm font-medium">Roles</div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm',
                    'hover:bg-muted/60',
                  )}
                >
                  <Checkbox
                    checked={roleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  <span className="flex-1">{asStr(role.label) || asStr(role.name)}</span>
                  <span className="text-xs text-muted-foreground">{asStr(role.name)}</span>
                </label>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={busy || name.trim() === ''} onClick={() => void create()}>
            Create key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

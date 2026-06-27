/**
 * UserMenu — avatar trigger + dropdown: identity, theme toggle, sign out.
 * Closes on outside click via a transparent fixed overlay (kit pattern).
 */
import { useState } from 'react'
import { Avatar } from '@latha/ui'
import { Check, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import type { Theme } from './useTheme.js'

export interface UserMenuProps {
  email: string | null
  role?: string | null
  theme: Theme
  onThemeChange: (t: Theme) => void
  onSignOut: () => void
}

function initials(email: string | null): string {
  const src = email?.trim()
  if (!src) return '?'
  const name = src.split('@')[0] || src
  const [a, b] = name.split(/[._-]+/).filter(Boolean)
  return (a && b ? `${a[0]}${b[0]}` : name.slice(0, 2)).toUpperCase()
}

export function UserMenu({ email, role, theme, onThemeChange, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={email ?? 'User menu'}
        className="flex h-9 items-center gap-inline rounded-md px-inline text-foreground hover:bg-accent"
      >
        <Avatar size="sm" fallback={initials(email)} alt={email ?? undefined} />
        <span className="hidden text-body font-medium sm:inline">{email}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+var(--space-tight))] z-[70] min-w-[224px] rounded-md border border-border bg-popover p-stack text-popover-foreground shadow-lg">
            <div className="px-inline pb-tight pt-inline">
              <div className="text-body font-medium">{email}</div>
              {role && (
                <div className="mt-stack flex items-center gap-stack text-caption capitalize text-muted-foreground">
                  <UserRound className="size-3" />
                  {role}
                </div>
              )}
            </div>
            <div className="my-stack h-px bg-border" />
            <p className="px-inline py-stack text-label text-muted-foreground">Theme</p>
            <button
              onClick={() => onThemeChange('light')}
              className="flex w-full items-center gap-inline rounded-sm px-inline py-tight text-small hover:bg-accent [&_svg]:size-4"
            >
              <Sun /> Light {theme === 'light' && <Check className="ml-auto size-3.5" />}
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className="flex w-full items-center gap-inline rounded-sm px-inline py-tight text-small hover:bg-accent [&_svg]:size-4"
            >
              <Moon /> Dark {theme === 'dark' && <Check className="ml-auto size-3.5" />}
            </button>
            <div className="my-stack h-px bg-border" />
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-inline rounded-sm px-inline py-tight text-small text-destructive hover:bg-accent [&_svg]:size-4"
            >
              <LogOut /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

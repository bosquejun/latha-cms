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
        onClick={() => setOpen((v) => !v)}
        aria-label={email ?? 'User menu'}
        className="flex h-9 items-center gap-2 rounded-md px-2 text-foreground hover:bg-accent"
      >
        <Avatar size="sm" fallback={initials(email)} alt={email ?? undefined} />
        <span className="hidden text-body font-medium sm:inline">{email}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-[70] min-w-[224px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
            <div className="px-2 pb-1.5 pt-2">
              <div className="text-body font-medium">{email}</div>
              {role && (
                <div className="mt-1 flex items-center gap-1 text-caption capitalize text-muted-foreground">
                  <UserRound className="size-3" />
                  {role}
                </div>
              )}
            </div>
            <div className="my-1 h-px bg-border" />
            <p className="px-2 py-1 text-label text-muted-foreground">Theme</p>
            <button
              onClick={() => onThemeChange('light')}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-small hover:bg-accent [&_svg]:size-4"
            >
              <Sun /> Light {theme === 'light' && <Check className="ml-auto size-3.5" />}
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-small hover:bg-accent [&_svg]:size-4"
            >
              <Moon /> Dark {theme === 'dark' && <Check className="ml-auto size-3.5" />}
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-small text-destructive hover:bg-accent [&_svg]:size-4"
            >
              <LogOut /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** UserMenu — avatar trigger + dropdown: identity, theme toggle, sign out. */
import {
  Avatar,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kon10/ui'
import { LogOut, Moon, Sun, UserRound } from 'lucide-react'
import type { Theme } from '@kon10/studio-sdk'

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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={email ?? 'User menu'}
          className="flex h-9 items-center gap-inline rounded-md px-inline text-foreground hover:bg-accent"
        >
          <Avatar size="sm" fallback={initials(email)} alt={email ?? undefined} />
          <span className="hidden text-body font-medium sm:inline">{email}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[224px]">
        <div className="px-inline pb-tight pt-inline">
          <div className="text-body font-medium">{email}</div>
          {role && (
            <div className="mt-stack flex items-center gap-stack text-caption capitalize text-muted-foreground">
              <UserRound className="size-3" />
              {role}
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={theme === 'light'}
          onCheckedChange={() => onThemeChange('light')}
        >
          <Sun /> Light
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={theme === 'dark'}
          onCheckedChange={() => onThemeChange('dark')}
        >
          <Moon /> Dark
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

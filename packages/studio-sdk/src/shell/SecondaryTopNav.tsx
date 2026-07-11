/**
 * SecondaryTopNav — the horizontal tab strip for top-level sections, docked
 * directly beneath MainTopNav. Replaces the old left sidebar's section list
 * one-for-one: one tab per section, mustard underline on the active tab.
 * Scrolls horizontally (no visible scrollbar) instead of wrapping; hidden
 * below `lg`, where the same items live in the MobileMenu sheet.
 */
import type { ComponentType } from 'react'
import { cn } from '@kon10/ui'
import type { NavLinkProps, ShellNavItem } from './nav.js'

export interface SecondaryTopNavProps {
  items: ShellNavItem[]
  activeKey?: string
  LinkComponent?: ComponentType<NavLinkProps>
}

const tabClass = (active: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors -mb-px',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-primary text-nav-foreground'
      : 'border-transparent text-nav-item-foreground hover:text-nav-foreground',
  )

export function SecondaryTopNav({ items, activeKey, LinkComponent }: SecondaryTopNavProps) {
  return (
    <nav
      aria-label="Sections"
      className="no-scrollbar sticky top-(--header-height) z-30 flex h-(--subnav-height) items-stretch gap-1 overflow-x-auto border-b border-nav-border bg-nav px-nav max-lg:hidden"
    >
      {items.map((item) => {
        const active = item.key === activeKey
        const body = (
          <>
            {item.icon ? <item.icon /> : null}
            {item.label}
          </>
        )
        if (LinkComponent && !item.external) {
          return (
            <LinkComponent key={item.key} href={item.href} className={tabClass(active)}>
              {body}
            </LinkComponent>
          )
        }
        return (
          <a
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={tabClass(active)}
            {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {body}
          </a>
        )
      })}
    </nav>
  )
}

/**
 * SectionSidebar — vertical sub-navigation for the active top-level section
 * (Content's collections, Settings' panels). Renders as a flush link column
 * on the page background, to the left of the content — no card chrome:
 * navigation stays quieter than the content cards it leads to, with the
 * active row's accent pill and the group labels carrying the structure.
 * Sticky below both bars; hidden below `lg`, where the same sub-items nest
 * under the active tab in the MobileMenu sheet.
 *
 * Hosts the `shell.sidebar.top` / `shell.sidebar.bottom` extension zones so
 * widgets registered against the old sidebar keep rendering.
 */
import type { ComponentType } from 'react'
import { cn } from '@kon10/ui'
import { Slot } from '../extensions/Slot.js'
import type { NavLinkProps, ShellNavItem, ShellNavSubItem } from './nav.js'

export interface SectionSidebarProps {
  item: ShellNavItem
  activeSubKey?: string
  LinkComponent?: ComponentType<NavLinkProps>
}

const subLinkClass = (active: boolean) =>
  cn(
    'flex touch-manipulation items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'bg-accent font-medium text-foreground [&_svg]:text-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:text-muted-foreground',
  )

export function SectionSidebar({ item, activeSubKey, LinkComponent }: SectionSidebarProps) {
  const groups = item.subItems ?? []

  const renderLink = (sub: ShellNavSubItem) => {
    const active = sub.key === activeSubKey
    const body = (
      <>
        {sub.icon ? <sub.icon /> : null}
        <span className="min-w-0 flex-1 truncate">{sub.label}</span>
        {sub.count != null ? (
          <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
            {sub.count}
          </span>
        ) : null}
      </>
    )
    if (LinkComponent && !sub.external) {
      return (
        <LinkComponent key={sub.key} href={sub.href} className={subLinkClass(active)}>
          {body}
        </LinkComponent>
      )
    }
    return (
      <a
        key={sub.key}
        href={sub.href}
        aria-current={active ? 'page' : undefined}
        className={subLinkClass(active)}
        {...(sub.external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {body}
      </a>
    )
  }

  return (
    <nav
      aria-label={`${item.label} navigation`}
      className="sticky top-[calc(var(--shell-top)+var(--space-page))] mb-page ml-page mt-page flex max-h-[calc(100dvh-var(--shell-top)-2*var(--space-page))] w-(--panel-left) shrink-0 self-start flex-col gap-card-gap overflow-y-auto max-lg:hidden"
    >
      <Slot zone="shell.sidebar.top" />
      <div className="flex flex-col gap-card-gap">
        <p className="px-2.5 text-label font-medium uppercase tracking-wider text-muted-foreground">
          {item.label}
        </p>
        {groups.map((group, index) => (
          <div key={group.label ?? index} className="flex flex-col gap-stack">
            {group.label ? (
              <p className="px-2.5 pb-1 text-label font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            ) : null}
            {group.items.map(renderLink)}
          </div>
        ))}
      </div>
      <Slot zone="shell.sidebar.bottom" />
    </nav>
  )
}

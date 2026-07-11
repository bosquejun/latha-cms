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
 * widgets registered against the old sidebar keep rendering. A labelled group
 * marked `collapsible` renders its heading as a fold toggle; a folded group
 * still opens when it holds the active page.
 */
import { useState, type ComponentType } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@kon10/ui'
import { Slot } from '../extensions/Slot.js'
import type { NavLinkProps, ShellNavGroup, ShellNavItem, ShellNavSubItem } from './nav.js'

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
  // Fold state per group label. Unset = the group's own default; an explicit
  // user toggle always wins, but an untouched `defaultCollapsed` group still
  // opens when it holds the active page so the current location stays visible.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isOpen = (group: ShellNavGroup) => {
    if (!group.collapsible || !group.label) return true
    const user = toggled[group.label]
    if (user != null) return user
    return !group.defaultCollapsed || group.items.some((sub) => sub.key === activeSubKey)
  }

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
        {groups.map((group, index) => {
          const open = isOpen(group)
          return (
            <div key={group.label ?? index} className="flex flex-col gap-stack">
              {group.label ? (
                group.collapsible ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setToggled((prev) => ({ ...prev, [group.label!]: !open }))
                    }
                    className="flex touch-manipulation items-center gap-1 px-2.5 pb-1 text-label font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>{group.label}</span>
                    <ChevronRight
                      className={cn('size-3 transition-transform', open && 'rotate-90')}
                    />
                  </button>
                ) : (
                  <p className="px-2.5 pb-1 text-label font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                )
              ) : null}
              {open ? group.items.map(renderLink) : null}
            </div>
          )
        })}
      </div>
      <Slot zone="shell.sidebar.bottom" />
    </nav>
  )
}

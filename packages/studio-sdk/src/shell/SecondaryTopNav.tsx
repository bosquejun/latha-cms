/**
 * SecondaryTopNav — the horizontal tab strip for top-level sections, docked
 * directly beneath MainTopNav. Replaces the old left sidebar's section list
 * one-for-one: one tab per section, mustard underline on the active tab.
 * Scrolls horizontally (no visible scrollbar) instead of wrapping; hidden
 * below `lg`, where the same items live in the MobileMenu sheet.
 */
import { useRef, type ComponentType, type Ref } from 'react'
import { cn } from '@kon10/ui'
import type { NavLinkProps, ShellNavItem } from './nav.js'

export interface SecondaryTopNavProps {
  items: ShellNavItem[]
  activeKey?: string
  LinkComponent?: ComponentType<NavLinkProps>
}

/** Controlled-animation handle exposed by `lucide-animated` icons. */
interface AnimatedIconHandle {
  startAnimation?: () => void
  stopAnimation?: () => void
}

const tabClass = (active: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors -mb-px',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-primary text-nav-foreground'
      : 'border-transparent text-nav-item-foreground hover:text-nav-foreground',
  )

/**
 * A single section tab. Owns a ref to its icon so hovering (or focusing)
 * anywhere on the tab replays the icon's animation — `lucide-animated` icons
 * only self-trigger when the pointer is directly over the small SVG, which the
 * tab body isn't. Attaching the ref puts those icons in controlled mode;
 * static `lucide-react` icons expose no handle and the calls are no-ops.
 */
function SecondaryTopNavTab({
  item,
  active,
  LinkComponent,
}: {
  item: ShellNavItem
  active: boolean
  LinkComponent?: ComponentType<NavLinkProps>
}) {
  const iconRef = useRef<AnimatedIconHandle | null>(null)
  const start = () => iconRef.current?.startAnimation?.()
  const stop = () => iconRef.current?.stopAnimation?.()
  // Widen the icon type locally so a ref can be attached; static icons land the
  // ref on their SVG element, where the optional handle calls no-op.
  const Icon = item.icon as
    | ComponentType<{ className?: string; ref?: Ref<AnimatedIconHandle | null> }>
    | undefined
  const body = (
    <>
      {Icon ? <Icon ref={iconRef} /> : null}
      {item.label}
    </>
  )
  const hoverProps = {
    onMouseEnter: start,
    onMouseLeave: stop,
    onFocus: start,
    onBlur: stop,
  }

  if (LinkComponent && !item.external) {
    return (
      <LinkComponent href={item.href} className={tabClass(active)} {...hoverProps}>
        {body}
      </LinkComponent>
    )
  }
  return (
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={tabClass(active)}
      {...hoverProps}
      {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {body}
    </a>
  )
}

export function SecondaryTopNav({ items, activeKey, LinkComponent }: SecondaryTopNavProps) {
  return (
    <nav
      aria-label="Sections"
      className="no-scrollbar sticky top-(--header-height) z-30 flex h-(--subnav-height) items-stretch gap-1 overflow-x-auto border-b border-nav-border bg-nav px-nav max-lg:hidden"
    >
      {items.map((item) => (
        <SecondaryTopNavTab
          key={item.key}
          item={item}
          active={item.key === activeKey}
          LinkComponent={LinkComponent}
        />
      ))}
    </nav>
  )
}

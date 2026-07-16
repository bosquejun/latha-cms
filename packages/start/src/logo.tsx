/**
 * Kon10Logo — the default Kon10 brand mark: the black "KO" monogram on the
 * signature gold tile. It's a self-contained inline SVG (no external asset, no
 * theme inversion — a brand mark keeps its own colors in light and dark), so it
 * ships inside the package and renders anywhere the login screen or Studio
 * shell needs a fallback logo.
 *
 * Apps that want their own logo pass `branding.logo` to `<Kon10Provider>` (a
 * URL from `studio.branding.logo`, or a React element) and never touch this —
 * it's only the default.
 */

import type { ReactNode } from 'react'

const GOLD = '#FFDE59'
const INK = '#0A0A0A'

/**
 * Resolve a `branding.logo` into a renderable mark. A string is an image
 * URL/path (as it arrives from `kon10.config`'s serializable `studio.branding`)
 * and becomes an `<img>`; a React element is used as-is; nothing falls back to
 * the default {@link Kon10Logo}.
 */
export function resolveBrandLogo(logo: ReactNode | undefined): ReactNode {
  if (logo == null || logo === '') return <Kon10Logo />
  if (typeof logo === 'string') {
    return <img src={logo} alt="" className="size-full object-contain" />
  }
  return logo
}

export function Kon10Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      role="img"
      aria-label="Kon10"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Gold tile */}
      <rect width="256" height="256" rx="58" fill={GOLD} />
      {/* Ink panel */}
      <rect x="36" y="36" width="184" height="184" rx="6" fill={INK} />
      {/* "K" — gold counters cut from the ink panel */}
      <path d="M60 69 L101 69 L60 128 L101 187 L60 187 Z" fill={GOLD} />
      <path d="M141 69 L92 128 L141 187 Z" fill={GOLD} />
      {/* "O" — gold pill */}
      <rect x="158" y="68" width="37" height="121" rx="18.5" fill={GOLD} />
    </svg>
  )
}

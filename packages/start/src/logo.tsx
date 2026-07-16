/**
 * Kon10Logo — the default Kon10 brand mark: the black "KO" monogram on the
 * signature lime tile. It's a self-contained inline SVG (no external asset, no
 * theme inversion — a brand mark keeps its own colors in light and dark), so it
 * ships inside the package and renders anywhere the login screen or Studio
 * shell needs a fallback logo.
 *
 * Apps that want their own logo pass `branding.logo` to `<Kon10Provider>` and
 * never touch this — it's only the default.
 */

import type { ReactNode } from 'react'

const LIME = '#D4EE4F'
const INK = '#0B0B0B'

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
      {/* Lime tile */}
      <rect width="256" height="256" rx="60" fill={LIME} />
      {/* Ink panel */}
      <rect x="48" y="48" width="160" height="160" rx="4" fill={INK} />
      {/* "K" — lime strokes cut from the ink panel */}
      <g
        stroke={LIME}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M80 82 V174" />
        <path d="M80 128 L122 82" />
        <path d="M80 128 L122 174" />
      </g>
      {/* "O" — lime ring with an ink counter */}
      <rect
        x="140"
        y="82"
        width="40"
        height="92"
        rx="20"
        fill="none"
        stroke={LIME}
        strokeWidth="16"
      />
    </svg>
  )
}

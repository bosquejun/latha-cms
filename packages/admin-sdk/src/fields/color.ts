/**
 * Hex <-> HSL conversion and a shade-scale generator, used by `TextField`'s
 * `meta.shades` preview. Pure color math, no persistence or CMS knowledge —
 * the scale is computed live from whatever hex the field currently holds and
 * never stored.
 */

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const HEX_COLOR_CAPTURE = /^#([0-9a-fA-F]{6})$/

interface Hsl {
  h: number
  s: number
  l: number
}

function hexToHsl(hex: string): Hsl | null {
  const match = HEX_COLOR_CAPTURE.exec(hex)
  if (!match?.[1]) return null
  const int = Number.parseInt(match[1], 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0)
      break
    case g:
      h = (b - r) / d + 2
      break
    default:
      h = (r - g) / d + 4
  }
  return { h: h / 6, s, l }
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToHex({ h, s, l }: Hsl): string {
  if (s === 0) {
    const v = Math.round(l * 255)
    return `#${[v, v, v].map((c) => c.toString(16).padStart(2, '0')).join('')}`
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hueToRgb(p, q, h + 1 / 3)
  const g = hueToRgb(p, q, h)
  const b = hueToRgb(p, q, h - 1 / 3)
  return `#${[r, g, b]
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/**
 * `count` lightness-derived shades of `hex`, lightest to darkest, with the
 * base color itself sitting at the middle index. Returns `[]` for an
 * incomplete/invalid hex (nothing to derive from yet).
 */
export function shadesOf(hex: string, count = 7): string[] {
  const base = hexToHsl(hex)
  if (!base) return []
  const mid = Math.floor(count / 2)
  const lightSteps = mid
  const darkSteps = count - 1 - mid
  const lightCeiling = 0.96
  const darkFloor = 0.08
  return Array.from({ length: count }, (_, i) => {
    const offset = i - mid
    if (offset === 0) return hex
    // Index before mid lightens toward `lightCeiling`; after mid darkens
    // toward `darkFloor`. Each side interpolates over its own step count, so
    // an uneven split (e.g. count=6, mid=3 -> 3 light, 2 dark) still reaches
    // its floor/ceiling at the outermost swatch either side.
    const l =
      offset < 0
        ? base.l + (-offset / (lightSteps || 1)) * (lightCeiling - base.l)
        : base.l - (offset / (darkSteps || 1)) * (base.l - darkFloor)
    return hslToHex({ h: base.h, s: base.s, l: clamp(l, darkFloor, lightCeiling) })
  })
}

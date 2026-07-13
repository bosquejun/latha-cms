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

export const SHADE_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const
export type ShadeStep = (typeof SHADE_STEPS)[number]

export interface ColorShade {
  step: ShadeStep
  hex: string
  isBase: boolean
}

/**
 * Target lightness anchors for a familiar 100-900 design-token scale. The
 * supplied brand color is placed at the nearest anchor instead of always at
 * 500: a deliberately dark primary such as #171717 therefore remains the
 * exact 900 token while still producing useful lighter values.
 */
const TARGET_LIGHTNESS: Record<ShadeStep, number> = {
  100: 0.96,
  200: 0.9,
  300: 0.82,
  400: 0.7,
  500: 0.58,
  600: 0.46,
  700: 0.35,
  800: 0.23,
  900: 0.1,
}

/**
 * A named 100-900 lightness scale derived from `hex`, lightest to darkest.
 * The base color is preserved exactly at the nearest lightness anchor.
 * Returns `[]` for an incomplete/invalid hex.
 */
export function shadesOf(hex: string): ColorShade[] {
  const base = hexToHsl(hex)
  if (!base) return []

  const baseIndex = SHADE_STEPS.reduce((nearest, step, index) => {
    const currentDistance = Math.abs(base.l - TARGET_LIGHTNESS[step])
    const nearestDistance = Math.abs(base.l - TARGET_LIGHTNESS[SHADE_STEPS[nearest]!])
    return currentDistance < nearestDistance ? index : nearest
  }, 0)

  const lightCeiling = 0.96
  const darkFloor = 0.06
  return SHADE_STEPS.map((step, index) => {
    if (index === baseIndex) return { step, hex, isBase: true }

    const l =
      index < baseIndex
        ? lightCeiling - (index / (baseIndex || 1)) * (lightCeiling - base.l)
        : base.l -
          ((index - baseIndex) / (SHADE_STEPS.length - 1 - baseIndex || 1)) *
            (base.l - darkFloor)

    return {
      step,
      hex: hslToHex({ h: base.h, s: base.s, l: clamp(l, darkFloor, lightCeiling) }),
      isBase: false,
    }
  })
}

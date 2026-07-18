import { z } from '@kon10/core'

/**
 * Zod escape hatch for color fields. The Studio's text renderer uses
 * `inputType: 'color'`; the schema keeps persisted values well-formed.
 */
export const hexColor = () =>
  z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a 6-digit hex color, e.g. #171717')

/**
 * A site-relative route that is not backed by a CMS page or post.
 */
export const internalPath = () =>
  z.string().regex(/^\//, 'Path must start with /, e.g. /shop')

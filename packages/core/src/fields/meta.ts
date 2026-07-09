import { z } from 'zod'

/**
 * Per-field rendering hints. The kernel carries this opaquely; only the admin
 * layer reads it. Zod-first: the schema is the source of truth and `FieldMeta`
 * is inferred from it (CLAUDE.md rule). `baseFieldConfigSchema` in `registry.ts`
 * reuses this schema so the two never diverge.
 */
export const fieldMetaSchema = z.object({
  /** Human-friendly label; defaults to a humanized field name. */
  label: z.string().optional(),
  /** Helper text shown beneath the input. */
  description: z.string().optional(),
  /** Placeholder for text-like inputs. */
  placeholder: z.string().optional(),
  /** Hide the field from the admin UI entirely (still persisted). */
  hidden: z.boolean().optional(),
  /** Render this field in the form sidebar rather than the main area. */
  sidebar: z.boolean().optional(),
  /**
   * Name of the form section this field belongs to. Fields sharing a `group`
   * are collected together; the admin form renders each group as a tab (in the
   * order groups first appear). Fields without a `group` collect into a leading
   * "General" tab. When no field in an entity sets `group`, the form renders
   * flat (no tabs) — this is a purely opt-in layout hint the kernel ignores.
   */
  group: z.string().optional(),
  /** Left add-on text shown inside the input border (e.g. 'https://'). */
  prefix: z.string().optional(),
  /** Right add-on text shown inside the input border (e.g. '.com'). */
  suffix: z.string().optional(),
  /** Native <input> type forwarded to the element (e.g. 'url', 'email', 'tel'). */
  inputType: z.string().optional(),
  /** Render a text field as a multi-line `<textarea>` instead of an `<input>`. */
  multiline: z.boolean().optional(),
  /**
   * Desktop column width within its tab/sidebar column. `'half'` pairs with
   * an adjacent `'half'` field into a two-up row (both stack full-width
   * below the `sm` breakpoint); omitted/`'full'` takes the whole row. Fields
   * are paired in declaration order — a lone trailing `'half'` just renders
   * full width.
   */
  width: z.enum(['full', 'half']).optional(),
  /**
   * Inside a `group()`, collapse this field behind an "Advanced settings"
   * disclosure instead of showing it up front. A group with no `advanced`
   * children renders flat, exactly as before — purely opt-in, kernel-ignored.
   */
  advanced: z.boolean().optional(),
  /**
   * For a `meta.inputType: 'color'` text field, show a row of tint/shade
   * swatches (derived from the current hex value) beneath the picker as a
   * live preview — clicking one sets the field to that shade. Preview only;
   * the shades themselves are never persisted.
   */
  shades: z.boolean().optional(),
})

export type FieldMeta = z.infer<typeof fieldMetaSchema>

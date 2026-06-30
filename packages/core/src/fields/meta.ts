/** Per-field rendering hints. The kernel carries this opaquely; only the admin layer reads it. */
export interface FieldMeta {
  /** Human-friendly label; defaults to a humanized field name. */
  label?: string
  /** Helper text shown beneath the input. */
  description?: string
  /** Placeholder for text-like inputs. */
  placeholder?: string
  /** Hide the field from the admin UI entirely (still persisted). */
  hidden?: boolean
  /** Render this field in the form sidebar rather than the main area. */
  sidebar?: boolean
  /** Left add-on text shown inside the input border (e.g. 'https://'). */
  prefix?: string
  /** Right add-on text shown inside the input border (e.g. '.com'). */
  suffix?: string
  /** Native <input> type forwarded to the element (e.g. 'url', 'email', 'tel'). */
  inputType?: string
}

/**
 * Read-only window onto the enclosing form's live values, for field renderers
 * that react to *sibling* fields (e.g. a slug input following the title).
 *
 * Deliberately form-library-agnostic: the form view adapts its state into a
 * `FormValuesStore` (the same decoupling as `FieldControlProps`), so renderers
 * never import react-hook-form. Outside a provider `useFieldValue` returns
 * `undefined` — renderers degrade gracefully in isolation/tests.
 */

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

export interface FormValuesStore {
  /** Current form values keyed by field name. */
  getValues(): Record<string, unknown>
  /** Notify `listener` on any value change; returns an unsubscribe. */
  subscribe(listener: () => void): () => void
}

const FormValuesContext = createContext<FormValuesStore | null>(null)

const emptyStore: FormValuesStore = {
  getValues: () => ({}),
  subscribe: () => () => {},
}

export function FormValuesProvider({
  store,
  children,
}: {
  store: FormValuesStore
  children: ReactNode
}) {
  return (
    <FormValuesContext.Provider value={store}>
      {children}
    </FormValuesContext.Provider>
  )
}

/**
 * Current value of a sibling field in the enclosing form, re-rendering when
 * it changes. `undefined` outside a `FormValuesProvider`.
 */
export function useFieldValue(name: string): unknown {
  const store = useContext(FormValuesContext) ?? emptyStore
  return useSyncExternalStore(store.subscribe, () => store.getValues()[name])
}

import { useEffect, useState } from 'react'

export interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: string | undefined
  reload: () => void
}

/** Minimal data-fetching hook: runs `fn` on mount / when `deps` change. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{
    data?: T
    loading: boolean
    error?: string
  }>({ loading: true })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setState({ loading: true })
    fn()
      .then((data) => active && setState({ data, loading: false }))
      .catch(
        (e) =>
          active &&
          setState({
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          }),
      )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    reload: () => setNonce((n) => n + 1),
  }
}

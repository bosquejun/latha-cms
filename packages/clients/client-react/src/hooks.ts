/**
 * Data hooks over the delivery client. Deliberately dependency-light — plain
 * `useState`/`useEffect`, no data-fetching library — so the package stays a
 * thin binding. Each hook re-runs when its request key changes (path + the
 * serializable query params) and aborts the in-flight request on unmount or
 * key change. Pass a `schema` for typed, validated results; omit it for the
 * generic `JsonDoc` shape.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ApiPagination,
  GetOptions,
  JsonDoc,
  ListOptions,
  ListResult,
} from '@kon10/client'
import { useDeliveryClient } from './context.js'

interface AsyncState<T> {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
}

/**
 * Run `run` whenever `key` changes, tracking loading/data/error. `run` is read
 * through a ref so a new closure each render never retriggers the effect — only
 * a changed `key` (or an explicit `refetch`) does.
 */
function useQuery<T>(
  key: string,
  run: (signal: AbortSignal) => Promise<T>,
): AsyncState<T> & { refetch: () => void } {
  const runRef = useRef(run)
  runRef.current = run
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    error: undefined,
    isLoading: true,
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: undefined }))
    runRef.current(controller.signal).then(
      (data) => {
        if (active) setState({ data, error: undefined, isLoading: false })
      },
      (err: unknown) => {
        if (!active || controller.signal.aborted) return
        setState({
          data: undefined,
          error: err instanceof Error ? err : new Error(String(err)),
          isLoading: false,
        })
      },
    )
    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, refetch }
}

/** Stable request key from the query-relevant (serializable) list params. */
function listKey(path: string, options: ListOptions<unknown>): string {
  const { page, pageSize, sort, where } = options
  return `list:${path}:${JSON.stringify({ page, pageSize, sort, where })}`
}

export interface UseListResult<T> {
  data: T[] | undefined
  pagination: ApiPagination | undefined
  error: Error | undefined
  isLoading: boolean
  refetch: () => void
}

/** A page of documents from a `'many'` entity. */
export function useList<T = JsonDoc>(
  path: string,
  options: ListOptions<T> = {},
): UseListResult<T> {
  const client = useDeliveryClient()
  const query = useQuery<ListResult<T>>(listKey(path, options), (signal) =>
    client.list<T>(path, { ...options, signal }),
  )
  return {
    data: query.data?.data,
    pagination: query.data?.pagination,
    error: query.error,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}

export interface UseDocResult<T> {
  /** The document, `null` when it doesn't exist, `undefined` while loading. */
  data: T | null | undefined
  error: Error | undefined
  isLoading: boolean
  refetch: () => void
}

/** One document by id. Pass `undefined` for `id` to skip the fetch (returns `null`). */
export function useDoc<T = JsonDoc>(
  path: string,
  id: string | undefined,
  options: GetOptions<T> = {},
): UseDocResult<T> {
  const client = useDeliveryClient()
  return useQuery<T | null>(`doc:${path}:${id ?? ''}`, (signal) =>
    id == null ? Promise.resolve(null) : client.get<T>(path, id, { ...options, signal }),
  )
}

/** A singleton entity's document. */
export function useSingle<T = JsonDoc>(
  path: string,
  options: GetOptions<T> = {},
): UseDocResult<T> {
  const client = useDeliveryClient()
  return useQuery<T | null>(`single:${path}`, (signal) =>
    client.single<T>(path, { ...options, signal }),
  )
}

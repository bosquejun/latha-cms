/**
 * useMediaQuery — subscribe to a CSS media query from React.
 *
 * SSR-safe: returns `false` on the server and for the first client render
 * (before the effect runs), so the initial tree matches the server markup and
 * hydration stays stable. Callers therefore get the "does not match" branch by
 * default — pick queries so that branch is the desktop/wide layout.
 */
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])

  return matches
}

/**
 * True below the `sm` breakpoint (~640px) — the phone layout boundary. `sm+`
 * (the default `false`) keeps the desktop layout, which is also what SSR renders.
 */
export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 639.98px)')
}

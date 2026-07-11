/**
 * useTheme — light/dark with localStorage persistence.
 *
 * Dark is the default theme (the unprefixed `:root` token scope); light is
 * opt-in via `.light` on <html>. SSR-safe: initial state is 'dark' and the
 * stored preference is applied in an effect after mount, so server and first
 * client render agree.
 */
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'kon10-theme'

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const stored = (typeof localStorage !== 'undefined' &&
      localStorage.getItem(STORAGE_KEY)) as Theme | null
    if (stored === 'dark' || stored === 'light') setThemeState(stored)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore quota/availability errors */
    }
  }

  return { theme, setTheme }
}

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const KEY = 'nodeget.theme'
const NO_TRANSITION_CLASS = 'no-theme-transition'

function initial(): Theme {
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggle = () => {
    const root = document.documentElement
    root.classList.add(NO_TRANSITION_CLASS)
    // Force reflow so the no-transition class is applied before the theme class changes.
    void root.offsetHeight
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove(NO_TRANSITION_CLASS)
      })
    })
  }

  return { theme, toggle }
}

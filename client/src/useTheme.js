import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ev-theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '')
    localStorage.setItem('ev-theme', theme)
  }, [theme])

  function toggle() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  return { theme, toggle }
}

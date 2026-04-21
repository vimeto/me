import type { GlobalProvider } from '@ladle/react'
import { useEffect } from 'react'
import '../src/index.css'

// Ladle's theme addon writes data-theme="dark" to the root; mirror it as the
// .dark class that our Tailwind config keys off of.
export const Provider: GlobalProvider = ({ children, globalState }) => {
  useEffect(() => {
    const root = document.documentElement
    if (globalState.theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [globalState.theme])
  return <div className="p-6 bg-background text-foreground min-h-screen">{children}</div>
}

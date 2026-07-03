import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { ease } from '@/lib/motion'

// Static VT monogram — the mobile trigger's closed state, extracted as a
// non-morphing brand mark for the desktop nav.
function VTMonogram() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1={4} y1={7} x2={8} y2={17} />
      <line x1={12} y1={7} x2={8} y2={17} />
      <line x1={13} y1={7} x2={20} y2={7} />
      <line x1={16.5} y1={7} x2={16.5} y2={17} />
    </svg>
  )
}

const sections = [
  { id: 'hero', label: 'Home' },
  { id: 'research', label: 'Research' },
  { id: 'projects', label: 'Projects' },
  { id: 'background', label: 'Background' },
  { id: 'future', label: 'Future' },
  { id: 'writing', label: 'Writing' },
  { id: 'contact', label: 'Contact' },
]

export function Navigation() {
  const [activeSection, setActiveSection] = useState('hero')
  const [isDark, setIsDark] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const onHome = location.pathname === '/'
  const onBlog = location.pathname.startsWith('/blog')

  // "Writing" is a real page (/blog), not a scroll target; it lights up there.
  const isActive = (id: string) =>
    id === 'writing' ? onBlog || (onHome && activeSection === id) : onHome && activeSection === id

  useEffect(() => {
    // The inline head script is the source of truth for first paint; mirror
    // whatever class it already applied.
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0,
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    sections.forEach(({ id }) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [onHome])

  // Close the drawer on Escape and lock body scroll while open.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [drawerOpen])

  const toggleDarkMode = () => {
    const newDarkMode = !isDark
    setIsDark(newDarkMode)
    localStorage.setItem('darkMode', String(newDarkMode))
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const goToSection = (id: string) => {
    setDrawerOpen(false)
    if (id === 'writing') {
      navigate('/blog', { viewTransition: true })
      return
    }
    if (onHome) {
      const element = document.getElementById(id)
      if (element) element.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate(`/#${id}`)
    }
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Desktop: brand mark + inline section list. Hidden on mobile. */}
            <div className="hidden md:flex items-center gap-6 overflow-x-auto">
              <button
                type="button"
                onClick={() => goToSection('hero')}
                aria-label="Back to top"
                className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-full border-2 border-foreground/80 bg-background text-foreground flex-shrink-0"
              >
                <VTMonogram />
              </button>
              {sections.map(({ id, label }) => {
                const active = isActive(id)
                return (
                  <button
                    key={id}
                    onClick={() => goToSection(id)}
                    className={`relative text-sm whitespace-nowrap transition-colors ${
                      active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute -bottom-1 left-0 right-0 h-[2px] bg-ink"
                        transition={{ duration: 0.32, ease }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Mobile: VT initials trigger. Decomposes V and T into 4 strokes;
                V's left and T's top fade out while V's right and T's stem
                rotate/translate into the two diagonals of an X. */}
            <button
              type="button"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={drawerOpen}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-full border-2 border-foreground/80 bg-background text-foreground"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                {/* V left stroke — fades when opening */}
                <motion.line
                  initial={false}
                  animate={{ x1: 4, y1: 7, x2: 8, y2: 17, opacity: drawerOpen ? 0 : 1 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                />
                {/* V right stroke — morphs into X's / diagonal */}
                <motion.line
                  initial={false}
                  animate={
                    drawerOpen ? { x1: 18, y1: 6, x2: 6, y2: 18 } : { x1: 12, y1: 7, x2: 8, y2: 17 }
                  }
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                />
                {/* T top bar — fades when opening */}
                <motion.line
                  initial={false}
                  animate={{ x1: 13, y1: 7, x2: 20, y2: 7, opacity: drawerOpen ? 0 : 1 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                />
                {/* T stem — morphs into X's \ diagonal */}
                <motion.line
                  initial={false}
                  animate={
                    drawerOpen
                      ? { x1: 6, y1: 6, x2: 18, y2: 18 }
                      : { x1: 16.5, y1: 7, x2: 16.5, y2: 17 }
                  }
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
            </button>

            {/* Dark mode toggle, always visible. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="ml-4 border border-border/60 hover:bg-accent flex-shrink-0"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer + backdrop. */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-label="Site navigation"
              aria-modal="true"
              className="fixed top-0 right-0 bottom-0 z-40 w-72 max-w-[85vw] bg-background border-l-2 border-foreground/80 shadow-2xl md:hidden"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.7 }}
            >
              <div className="flex flex-col h-full pt-20 pb-8 px-6">
                <ul className="flex flex-col gap-1">
                  {sections.map(({ id, label }, i) => (
                    <motion.li
                      key={id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.035, duration: 0.22 }}
                    >
                      <button
                        type="button"
                        onClick={() => goToSection(id)}
                        className={`w-full text-left py-3.5 px-3 min-h-[44px] text-base transition-colors border-b border-border/60 ${
                          isActive(id) ? 'font-bold' : 'text-foreground/80 hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    </motion.li>
                  ))}
                </ul>
                <div className="mt-auto text-xs text-muted-foreground">vtoivonen.com</div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

import { Outlet, useLocation } from 'react-router'
import { useEffect } from 'react'
import { Navigation } from '@/components/layout/Navigation'

export function RootLayout() {
  const location = useLocation()

  // Honor hash navigation after route changes (e.g. /#research from /blog/*).
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1))
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0 })
    }
  }, [location.pathname, location.hash])

  return (
    <>
      <Navigation />
      <main className="pt-16">
        <Outlet />
      </main>
    </>
  )
}

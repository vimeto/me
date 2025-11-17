import { Navigation } from '@/components/layout/Navigation'
import { Hero } from '@/components/sections/Hero'
import { Research } from '@/components/sections/Research'
import { Projects } from '@/components/sections/Projects'
import { Background } from '@/components/sections/Background'
import { Future } from '@/components/sections/Future'
import { Writing } from '@/components/sections/Writing'
import { Contact } from '@/components/sections/Contact'

function App() {
  return (
    <>
      <Navigation />
      <main className="pt-16">
        <Hero />
        <Research />
        <Projects />
        <Background />
        <Future />
        <Writing />
        <Contact />
      </main>
    </>
  )
}

export default App

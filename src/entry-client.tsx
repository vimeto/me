import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root')!

// After prerender (`pnpm build`) the #root element already contains server-
// rendered markup — hydrate in place. During `pnpm dev` it is empty — mount
// fresh. Detecting by children count is the canonical cheap heuristic.
if (root.hasChildNodes()) {
  hydrateRoot(
    root,
    <StrictMode>
      <App />
    </StrictMode>
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

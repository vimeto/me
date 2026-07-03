import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root')!

// After prerender (`pnpm build`) the #root element already contains server-
// rendered markup — hydrate in place. During `pnpm dev` it holds only the
// `<!--app-html-->` placeholder comment — mount fresh. `hasChildNodes()` counts
// that comment as a child, so gate on *element* children instead.
if (root.childElementCount > 0) {
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

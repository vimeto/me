import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { routes } from '@/routes'
import { renderRoutes } from '@/lib/ssr-routes'
import './index.css'

export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>{renderRoutes(routes)}</StaticRouter>
    </StrictMode>
  )
}

export { getAllStaticPaths } from '@/routes'
export { getPageMeta, renderMetaTags, SITE, type PageMeta } from '@/lib/seo'
export { listPosts } from '@/lib/content/posts'

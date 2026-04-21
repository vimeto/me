import type { RouteObject } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import Home from '@/pages/Home'
import BlogIndex from '@/routes/blog/index'
import BlogPost from '@/routes/blog/$slug'
import AdminPage from '@/routes/admin/index'
import { listPosts } from '@/lib/content/posts'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/blog', element: <BlogIndex /> },
      { path: '/blog/:slug', element: <BlogPost /> },
      // `/admin` is dynamic + Cloudflare-Access-gated. It's mounted in the
      // router so the SPA can serve it, but we deliberately omit it from
      // `getAllStaticPaths` so no public HTML snapshot is ever generated.
      { path: '/admin', element: <AdminPage /> },
    ],
  },
]

// All static paths the prerender script should visit. `listPosts()` filters
// out drafts by default, so draft posts never get a public HTML page — they
// remain reachable only in the dev server's client-only routing.
export function getAllStaticPaths(): string[] {
  const postPaths = listPosts().map((p) => p.permalink)
  return ['/', '/blog', ...postPaths]
}

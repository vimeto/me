import type { RouteObject } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import Home from '@/pages/Home'
import BlogIndex from '@/routes/blog/index'
import BlogPost from '@/routes/blog/$slug'
import { listPosts } from '@/lib/content/posts'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/blog', element: <BlogIndex /> },
      { path: '/blog/:slug', element: <BlogPost /> },
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

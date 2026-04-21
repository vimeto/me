import { createBrowserRouter, RouterProvider } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import Home from '@/pages/Home'
import BlogIndex from '@/routes/blog/index'
import BlogPost from '@/routes/blog/$slug'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/blog', element: <BlogIndex /> },
      { path: '/blog/:slug', element: <BlogPost /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App

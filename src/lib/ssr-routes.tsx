import type { RouteObject } from 'react-router'
import { useRoutes } from 'react-router'

export function renderRoutes(routes: RouteObject[]) {
  return <RoutesFromObjects routes={routes} />
}

function RoutesFromObjects({ routes }: { routes: RouteObject[] }) {
  return useRoutes(routes)
}

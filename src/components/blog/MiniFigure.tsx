import { useMemo } from 'react'
import { getCompute, type ComputeResult, type Point } from '@/components/mdx/compute'
import { series, seriesOrder, type SeriesKey } from '@/components/mdx/theme/tokens'

type Props = {
  compute: string
  params: Record<string, number | string | boolean>
  kind: 'line' | 'area' | 'bar'
  className?: string
}

const W = 320
const H = 200
const PAD = 10

type Group = { key: SeriesKey; points: Point[] }

function groupBySeries(result: ComputeResult): Group[] {
  const groups = new Map<string | undefined, Point[]>()
  for (const p of result.points) {
    const arr = groups.get(p.series) ?? []
    arr.push(p)
    groups.set(p.series, arr)
  }
  const names: (string | undefined)[] = []
  if (result.seriesKeys) {
    for (const k of result.seriesKeys) {
      if (groups.has(k) && !names.includes(k)) names.push(k)
    }
  }
  for (const k of groups.keys()) if (!names.includes(k)) names.push(k)
  return names.map((name, i) => ({
    key: seriesOrder[i % seriesOrder.length],
    points: groups.get(name) ?? [],
  }))
}

function extent(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  let min = values[0]
  let max = values[0]
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === max) return [min - 0.5, max + 0.5]
  return [min, max]
}

/**
 * Static, non-interactive thumbnail of a post's first chart. No axes, grid,
 * texture, or randomness — it must prerender byte-identically to hydration.
 */
export function MiniFigure({ compute, params, kind, className }: Props) {
  const result = useMemo<ComputeResult | null>(() => {
    const fn = getCompute(compute)
    if (!fn) return null
    try {
      return fn(params)
    } catch {
      return null
    }
  }, [compute, params])

  if (!result || result.points.length === 0) return null

  const xs = result.points.map((p) => p.x)
  const ys = result.points.map((p) => p.y)
  const [x0, x1] = result.xDomain ?? extent(xs)
  const [y0, y1] = result.yDomain ?? extent(ys)

  const sx = (x: number) => {
    if (x1 === x0) return W / 2
    return PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD)
  }
  const sy = (y: number) => {
    if (y1 === y0) return H / 2
    return H - PAD - ((y - y0) / (y1 - y0)) * (H - 2 * PAD)
  }

  const groups = groupBySeries(result)
  const baseline = H - PAD

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`block h-full w-full ${className ?? ''}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {kind === 'bar' &&
        groups.map((g, gi) => {
          const bw = Math.max(1, (W - 2 * PAD) / Math.max(1, g.points.length) - 1)
          const s = series[g.key]
          return (
            <g key={gi}>
              {g.points.map((p, i) => {
                const yTop = sy(p.y)
                return (
                  <rect
                    key={i}
                    x={sx(p.x) - bw / 2}
                    y={yTop}
                    width={bw}
                    height={Math.max(0, baseline - yTop)}
                    fill={s.fill}
                    stroke={s.stroke}
                    strokeWidth={1}
                  />
                )
              })}
            </g>
          )
        })}

      {kind === 'area' &&
        groups.map((g, gi) => {
          if (g.points.length === 0) return null
          const s = series[g.key]
          const line = g.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' L')
          const first = g.points[0]
          const last = g.points[g.points.length - 1]
          const d = `M${sx(first.x)},${baseline} L${line} L${sx(last.x)},${baseline} Z`
          return <path key={gi} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={2} />
        })}

      {kind === 'line' &&
        groups.map((g, gi) => {
          if (g.points.length === 0) return null
          const s = series[g.key]
          const d = 'M' + g.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' L')
          return (
            <path
              key={gi}
              d={d}
              fill="none"
              stroke={s.stroke}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}

      <line
        x1={PAD}
        x2={W - PAD}
        y1={baseline}
        y2={baseline}
        stroke="rgb(var(--foreground) / 0.25)"
        strokeWidth={1}
      />
    </svg>
  )
}

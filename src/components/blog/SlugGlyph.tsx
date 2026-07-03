import type { ReactNode } from 'react'

type Props = {
  slug: string
  className?: string
}

const W = 320
const H = 200

// Deterministic fingerprint for posts without a chart. Pure function of the
// slug (no Math.random / Date) so SSR and hydration render identically.
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HAIRLINE = 'rgb(var(--foreground) / 0.25)'
const RULE = 'rgb(var(--foreground) / 0.7)'
const INK = 'rgb(var(--ink))'

export function SlugGlyph({ slug, className }: Props) {
  const rnd = mulberry32(hashString(slug))

  const lineCount = 3 + Math.floor(rnd() * 3) // 3–5
  const ys: number[] = []
  for (let i = 0; i < lineCount; i++) {
    ys.push(24 + Math.floor(rnd() * (H - 48)))
  }
  ys.sort((a, b) => a - b)

  const heavyY = ys[Math.floor(rnd() * ys.length)]

  const markCount = 2 + Math.floor(rnd() * 3) // 2–4
  const marks: ReactNode[] = []
  for (let i = 0; i < markCount; i++) {
    const x = 30 + Math.floor(rnd() * (W - 60))
    const y = ys[Math.floor(rnd() * ys.length)]
    const type = Math.floor(rnd() * 3)
    if (type === 0) {
      const size = 6 + Math.floor(rnd() * 5) // 6–10
      marks.push(
        <rect
          key={`m${i}`}
          x={x - size / 2}
          y={y - size / 2}
          width={size}
          height={size}
          fill={INK}
        />
      )
    } else if (type === 1) {
      const r = 6 + Math.floor(rnd() * 4) // radius → 12–18 diameter
      marks.push(
        <circle key={`m${i}`} cx={x} cy={y} r={r} fill="none" stroke={INK} strokeWidth={2} />
      )
    } else {
      const len = 10 + Math.floor(rnd() * 7) // 10–16
      marks.push(
        <line
          key={`m${i}`}
          x1={x}
          x2={x}
          y1={y - len / 2}
          y2={y + len / 2}
          stroke={INK}
          strokeWidth={2}
        />
      )
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`block h-full w-full ${className ?? ''}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {ys.map((y, i) => (
        <line
          key={`h${i}`}
          x1={16}
          x2={W - 16}
          y1={y}
          y2={y}
          stroke={y === heavyY ? RULE : HAIRLINE}
          strokeWidth={y === heavyY ? 2 : 1}
        />
      ))}
      {marks}
    </svg>
  )
}

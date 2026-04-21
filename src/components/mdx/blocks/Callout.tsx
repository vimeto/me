import type { ReactNode } from 'react'
import { CalloutProps } from '@/schemas/blocks'
import { series } from '../theme/tokens'

const toneSeries = {
  info: 'teal',
  warn: 'amber',
  insight: 'violet',
  aside: 'lime',
} as const

export function Callout(rawProps: unknown & { children?: ReactNode }) {
  const { children, ...rest } = rawProps as { children?: ReactNode; [k: string]: unknown }
  const props = CalloutProps.parse(rest)
  const key = toneSeries[props.tone]
  const s = series[key]
  const patternId = `callout-stripe-${key}`
  return (
    <aside
      className="not-prose my-5 rounded-md border-2 overflow-hidden"
      style={{
        borderColor: s.stroke,
        background: `linear-gradient(135deg, ${s.fillStrong}, ${s.fill})`,
      }}
    >
      <svg
        aria-hidden="true"
        className="block w-full"
        height="6"
        preserveAspectRatio="none"
        viewBox="0 0 100 6"
      >
        <defs>
          <pattern
            id={patternId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill={s.fillStrong} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={s.stroke} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100" height="6" fill={`url(#${patternId})`} />
      </svg>
      <div className="px-4 py-3">
        {props.title && (
          <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: s.text }}>
            {props.title}
          </p>
        )}
        <div className="text-sm text-foreground [&>p:last-child]:mb-0 [&>p]:mb-2">{children}</div>
      </div>
    </aside>
  )
}

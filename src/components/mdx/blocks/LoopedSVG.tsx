import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { LoopedSVGProps } from '@/schemas/blocks'
import { seriesAt, series } from '../theme/tokens'

type Preset = 'pulse' | 'wave' | 'orbit' | 'scan'

function PulseLoop({ duration }: { duration: number }) {
  const s = series.teal
  const accent = series.magenta
  return (
    <svg viewBox="0 0 240 120" width="100%" role="img" aria-label="pulse loop">
      <rect x="0" y="0" width="240" height="120" fill="transparent" />
      <motion.circle
        cx="120"
        cy="60"
        r="20"
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth="2"
        animate={{ r: [20, 44, 20], opacity: [1, 0.2, 1] }}
        transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx="120"
        cy="60"
        r="8"
        fill={accent.fillStrong}
        stroke={accent.stroke}
        strokeWidth="2"
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ duration: duration * 0.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  )
}

function WaveLoop({ duration }: { duration: number }) {
  const s = series.violet
  const segments = 60
  const width = 240
  const height = 120
  const mid = height / 2
  const amp = 30
  const period = 2
  const d = Array.from({ length: segments + 1 }, (_, i) => {
    const x = (i / segments) * width
    const y = mid + amp * Math.sin((i / segments) * period * 2 * Math.PI)
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="wave loop">
      <defs>
        <linearGradient id="loopsvg-wave-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={s.fillStrong} />
          <stop offset="100%" stopColor={s.fill} />
        </linearGradient>
      </defs>
      <motion.path
        d={d}
        fill="none"
        stroke={s.stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        animate={{ x: [-width / period, 0] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
      <motion.path
        d={d}
        fill="url(#loopsvg-wave-grad)"
        opacity="0.4"
        animate={{ x: [-width / period, 0] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  )
}

function OrbitLoop({ duration }: { duration: number }) {
  const center = series.amber
  const orbit = series.teal
  const cx = 120
  const cy = 60
  const r = 36
  return (
    <svg viewBox="0 0 240 120" width="100%" role="img" aria-label="orbit loop">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={center.stroke}
        strokeDasharray="2 4"
        strokeOpacity="0.5"
      />
      <circle
        cx={cx}
        cy={cy}
        r="10"
        fill={center.fillStrong}
        stroke={center.stroke}
        strokeWidth="2"
      />
      <motion.g
        style={{ originX: `${cx}px`, originY: `${cy}px` }}
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      >
        <circle
          cx={cx + r}
          cy={cy}
          r="6"
          fill={orbit.fillStrong}
          stroke={orbit.stroke}
          strokeWidth="2"
        />
      </motion.g>
    </svg>
  )
}

function ScanLoop({ duration }: { duration: number }) {
  const s = seriesAt(3)
  return (
    <svg viewBox="0 0 240 120" width="100%" role="img" aria-label="scan loop">
      <rect
        x="10"
        y="20"
        width="220"
        height="80"
        rx="6"
        fill="none"
        stroke={s.stroke}
        strokeWidth="2"
      />
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={i}
          x1="20"
          x2="230"
          y1={34 + i * 12}
          y2={34 + i * 12}
          stroke={s.stroke}
          strokeOpacity="0.2"
        />
      ))}
      <motion.rect
        x="10"
        width="20"
        height="80"
        y="20"
        fill={s.fillStrong}
        stroke={s.stroke}
        strokeWidth="1.5"
        animate={{ x: [10, 210, 10] }}
        transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  )
}

const presets: Record<Preset, (p: { duration: number }) => React.ReactElement> = {
  pulse: PulseLoop,
  wave: WaveLoop,
  orbit: OrbitLoop,
  scan: ScanLoop,
}

export function LoopedSVG(rawProps: unknown) {
  const props = LoopedSVGProps.parse(rawProps)
  const { preset, title, caption, height, paused: initialPaused } = props
  const reducedMotion = useReducedMotion()
  const [paused, setPaused] = useState(initialPaused)
  const neutral = series.teal
  const Body = presets[preset]
  // Respect prefers-reduced-motion: a tiny constant duration freezes the loop
  // without unmounting motion components. Manual pause behaves the same way.
  const runningDuration = paused || reducedMotion ? 1e7 : props.duration

  return (
    <figure className="not-prose my-6">
      {title && (
        <figcaption className="mb-2 text-sm font-medium text-foreground">{title}</figcaption>
      )}
      <div
        className="relative rounded-md border-2 bg-card overflow-hidden"
        style={{ borderColor: neutral.stroke, height: height ?? undefined }}
      >
        <div className="p-3">
          <Body duration={runningDuration} />
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="absolute top-2 right-2 rounded-md border-2 px-2 py-1 text-xs font-semibold bg-card/80 backdrop-blur"
          style={{ borderColor: neutral.stroke, color: neutral.text }}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>
      {caption && <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}

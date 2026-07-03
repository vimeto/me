import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { RuleDraw } from '@/components/ui/rule-draw'

type Props = {
  number: string
  title: string
  note?: string
  /** Inline style for the title span; used to tag it with a view-transition-name. */
  titleStyle?: React.CSSProperties
}

// Counts the section numeral up from "00" to its value on first view. The final
// value is rendered in the initial markup so the prerendered HTML matches — the
// animation only runs after mount, driven by useEffect, so there is no hydration
// mismatch.
function CountUpNumber({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)

  const target = parseInt(value, 10)
  const width = value.length

  useEffect(() => {
    if (reduced || !inView || Number.isNaN(target)) return
    let raf = 0
    const duration = 400
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const current = Math.round(t * target)
      setDisplay(String(current).padStart(width, '0'))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    setDisplay('0'.padStart(width, '0'))
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced, target, width])

  return (
    <span ref={ref} className="font-mono text-xs text-ink tabular-nums tracking-tight">
      {display}
    </span>
  )
}

export function SectionHeader({ number, title, note, titleStyle }: Props) {
  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="flex items-baseline gap-3 md:gap-4">
          <CountUpNumber value={number} />
          <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">
            /
          </span>
          <span className="text-2xl font-bold tracking-tight" style={titleStyle}>
            {title}
          </span>
        </h2>
        {note && (
          <span className="font-serif italic text-muted-foreground tabular-nums whitespace-nowrap">
            {note}
          </span>
        )}
      </div>
      <RuleDraw className="mt-4 h-[2px] bg-foreground" />
    </div>
  )
}

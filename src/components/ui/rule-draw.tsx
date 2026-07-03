import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ease, viewportOnce } from '@/lib/motion'

type Props = {
  className?: string
  delay?: number
}

export function RuleDraw({ className, delay = 0 }: Props) {
  const reduced = useReducedMotion()
  if (reduced) {
    return <div className={cn('h-px bg-foreground', className)} aria-hidden="true" />
  }
  return (
    <motion.div
      aria-hidden="true"
      className={cn('h-px bg-foreground origin-left', className)}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={viewportOnce}
      transition={{ duration: 0.4, ease, delay }}
    />
  )
}

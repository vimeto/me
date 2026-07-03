import type { Variants } from 'framer-motion'
import { motion } from '@/components/mdx/theme/tokens'

export const ease = motion.ease
export const durFast = motion.durationFast
export const durBase = motion.durationBase

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: durBase, ease } },
}

export function staggerChildren(delay = 0.06): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: delay } },
  }
}

export const viewportOnce = { once: true, margin: '-10% 0px' } as const

import { LoopedSVG } from '../src/components/mdx/blocks/LoopedSVG'

export default {
  title: 'Blocks / LoopedSVG',
}

export const Pulse = () => <LoopedSVG preset="pulse" title="Pulse" />
export const Wave = () => <LoopedSVG preset="wave" title="Wave" />
export const Orbit = () => <LoopedSVG preset="orbit" title="Orbit" />
export const Scan = () => <LoopedSVG preset="scan" title="Scan" />

export const InitiallyPaused = () => (
  <LoopedSVG preset="pulse" title="Pulse (paused)" paused caption="Click Play." />
)

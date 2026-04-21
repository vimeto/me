import type { ReactNode } from 'react'
import { ParentSize } from '@visx/responsive'
import { VizTextures } from '../theme/VizTextures'

export type PlotMargin = { top: number; right: number; bottom: number; left: number }

export type PlotDims = {
  width: number
  height: number
  inner: { width: number; height: number }
  margin: PlotMargin
}

type RenderProps = PlotDims

type Props = {
  ariaLabel: string
  caption?: string
  height?: number
  margin?: PlotMargin
  children: (dims: RenderProps) => ReactNode
}

const defaultMargin: PlotMargin = { top: 16, right: 20, bottom: 36, left: 44 }

export function Plot({
  ariaLabel,
  caption,
  height = 320,
  margin = defaultMargin,
  children,
}: Props) {
  return (
    <figure className="not-prose my-6">
      <div
        className="relative rounded-md border-2 border-foreground/80 bg-card overflow-hidden"
        style={{ boxShadow: '0 1px 0 rgb(0 0 0 / 0.04)' }}
      >
        <ParentSize debounceTime={10}>
          {({ width }) => {
            if (width < 1) return null
            const inner = {
              width: Math.max(0, width - margin.left - margin.right),
              height: Math.max(0, height - margin.top - margin.bottom),
            }
            return (
              <svg
                width={width}
                height={height}
                role="img"
                aria-label={ariaLabel}
                className="block"
              >
                <VizTextures />
                {children({ width, height, inner, margin })}
              </svg>
            )
          }}
        </ParentSize>
      </div>
      {caption && <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}

import type { ComponentPropsWithoutRef } from 'react'
import type { MDXComponents } from 'mdx/types'
import { Figure } from './blocks/Figure'
import { Callout } from './blocks/Callout'
import { ParamPlot } from './blocks/ParamPlot'
import { Quiz } from './blocks/Quiz'
import { LoopedSVG } from './blocks/LoopedSVG'

export const blockRegistry = {
  Figure,
  Callout,
  ParamPlot,
  Quiz,
  LoopedSVG,
} as const

export type BlockName = keyof typeof blockRegistry

// Wide markdown tables must scroll inside their own container instead of
// pushing past the viewport on narrow screens.
function ScrollableTable(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  )
}

export const mdxComponents: MDXComponents = {
  ...blockRegistry,
  table: ScrollableTable,
}

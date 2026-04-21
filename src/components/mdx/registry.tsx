import type { MDXComponents } from 'mdx/types'
import { Figure } from './blocks/Figure'
import { Callout } from './blocks/Callout'
import { ParamPlot } from './blocks/ParamPlot'

export const blockRegistry = {
  Figure,
  Callout,
  ParamPlot,
} as const

export type BlockName = keyof typeof blockRegistry

export const mdxComponents: MDXComponents = {
  ...blockRegistry,
}

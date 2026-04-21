import type { ComputeFn } from './types'
import { gptqFlippingRange } from './gptq'

export const computeRegistry: Record<string, ComputeFn> = {
  'gptq.flippingRange': gptqFlippingRange,
}

export function getCompute(key: string): ComputeFn | undefined {
  return computeRegistry[key]
}

export type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

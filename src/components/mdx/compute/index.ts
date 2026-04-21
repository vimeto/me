import type { ComputeFn } from './types'
import { gptqFlippingRange } from './gptq'
import { servingLatencyTail } from './latency'

export const computeRegistry: Record<string, ComputeFn> = {
  'gptq.flippingRange': gptqFlippingRange,
  'serving.latencyTail': servingLatencyTail,
}

export function getCompute(key: string): ComputeFn | undefined {
  return computeRegistry[key]
}

export type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

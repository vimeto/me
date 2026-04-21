export type ComputeValue = number | string | boolean
export type ComputeParams = Record<string, ComputeValue>

export type Point = { x: number; y: number; series?: string }

export type ComputeResult = {
  points: Point[]
  annotations?: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  >
  xDomain?: [number, number]
  yDomain?: [number, number]
  seriesKeys?: string[]
  summary?: { label: string; value: string }[]
}

export type ComputeFn = (params: ComputeParams) => ComputeResult

import type { ComputeFn, ComputeParams } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * M/M/1 tail latency.
 *
 * Given Poisson arrivals at rate λ (qps) and i.i.d. exponential service with
 * mean `serviceMs`, the steady-state response-time tail is
 *   P(T > t) = exp(-(μ - λ) * t), valid while ρ = λ/μ < 1.
 * We plot y = P(T > t) vs. t in milliseconds, annotate the SLA line with a
 * vline, and report ρ, mean latency, and p99 in the summary.
 */
export const servingLatencyTail: ComputeFn = (params) => {
  const qps = Math.max(0, asNumber(params, 'qps', 120))
  const serviceMs = Math.max(0.01, asNumber(params, 'serviceMs', 6))
  const slaMs = Math.max(0, asNumber(params, 'slaMs', 50))
  const rangeMs = Math.max(serviceMs * 2, asNumber(params, 'rangeMs', 200))

  const muPerMs = 1 / serviceMs // services per ms
  const lambdaPerMs = qps / 1000 // arrivals per ms
  const stable = lambdaPerMs < muPerMs
  const rho = lambdaPerMs / muPerMs
  const drain = muPerMs - lambdaPerMs // positive when stable

  const samples = 321
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < samples; i++) {
    const t = (rangeMs * i) / (samples - 1)
    let y: number
    if (!stable) {
      y = 1
    } else {
      y = Math.exp(-drain * t)
    }
    points.push({ x: t, y })
  }

  const meanMs = stable ? 1 / drain : Infinity
  const p99Ms = stable ? Math.log(100) / drain : Infinity

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = []
  if (slaMs > 0 && slaMs <= rangeMs) {
    annotations.push({ type: 'vline', x: slaMs, label: `SLA = ${slaMs.toFixed(0)} ms` })
  }
  if (stable && p99Ms <= rangeMs) {
    annotations.push({
      type: 'band',
      from: p99Ms,
      to: rangeMs,
      axis: 'x',
      label: 'beyond p99',
    })
  }

  const fmt = (ms: number) => (Number.isFinite(ms) ? `${ms.toFixed(1)} ms` : '∞')

  return {
    points,
    xDomain: [0, rangeMs],
    yDomain: [0, 1],
    annotations,
    summary: [
      { label: 'Utilization ρ', value: stable ? rho.toFixed(2) : '≥ 1 (unstable)' },
      { label: 'Mean latency', value: fmt(meanMs) },
      { label: 'p99 latency', value: fmt(p99Ms) },
    ],
  }
}

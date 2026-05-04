import type { ComputeFn, ComputeParams } from './types'

// Abramowitz & Stegun 7.1.26 approximation of erf.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax)
  return sign * y
}

// Φ(z) for standard normal.
function phi(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * GPTQ flipping-range curve (teaching version).
 *
 * Intuition: a bits-bit symmetric quantizer places `levels = 2^bits` grid
 * points over [-range, range]; round-to-nearest flips a scalar weight w when
 * an error-feedback perturbation pushes it across the nearest half-step
 * boundary. With a Gaussian perturbation e ~ N(0, σ²) (σ in the same units
 * as w), the per-weight flip probability is
 *   p_flip(w) = 2 * (1 - Φ(d(w) / σ))
 * where d(w) is the distance from w to the nearest inter-level boundary.
 *
 * The "flipping range" is the set {w : p_flip(w) ≥ threshold}. Lowering
 * bits widens the grid step, so boundaries sit further apart and the teeth
 * spread out; each tooth still peaks at 1 because p_flip(boundary) = 1
 * regardless of grid spacing.
 */
export const gptqFlippingRange: ComputeFn = (params) => {
  const bits = Math.round(asNumber(params, 'bits', 3))
  const sigma = Math.max(1e-4, asNumber(params, 'sigma', 0.25))
  const threshold = Math.min(0.99, Math.max(0.01, asNumber(params, 'threshold', 0.3)))
  const range = Math.max(1, asNumber(params, 'range', 3))
  const levels = Math.max(2, Math.pow(2, bits))
  const step = (2 * range) / (levels - 1)

  const samples = 321
  const points = []
  let flipRangeCount = 0
  for (let i = 0; i < samples; i++) {
    const w = -range + (2 * range * i) / (samples - 1)
    // Grid levels sit at -range + k·step; boundaries halfway between.
    // Position in grid-step units, shifted so boundaries are at integers + 0.5.
    const u = (w + range) / step
    const frac = u - Math.floor(u)
    const d = Math.abs(frac - 0.5) * step
    const p = Math.min(1, Math.max(0, 2 * (1 - phi(d / sigma))))
    if (p >= threshold) flipRangeCount++
    points.push({ x: w, y: p })
  }

  const bands: Array<{
    type: 'band'
    from: number
    to: number
    label?: string
    axis?: 'x' | 'y'
  }> = []
  let bandStart: number | null = null
  for (let i = 0; i < points.length; i++) {
    const above = points[i].y >= threshold
    if (above && bandStart === null) bandStart = points[i].x
    if (!above && bandStart !== null) {
      bands.push({ type: 'band', from: bandStart, to: points[i - 1].x, axis: 'x' })
      bandStart = null
    }
  }
  if (bandStart !== null) {
    bands.push({
      type: 'band',
      from: bandStart,
      to: points[points.length - 1].x,
      axis: 'x',
    })
  }

  const flipFraction = flipRangeCount / samples

  return {
    points,
    xDomain: [-range, range],
    yDomain: [0, 1],
    annotations: [
      { type: 'hline', y: threshold, label: `threshold = ${threshold.toFixed(2)}` },
      ...bands,
    ],
    summary: [
      { label: 'Grid levels', value: String(levels) },
      { label: 'Grid step Δ', value: step.toFixed(3) },
      { label: 'σ / Δ', value: (sigma / step).toFixed(2) },
      { label: 'Flipping range', value: `${(flipFraction * 100).toFixed(1)}%` },
    ],
  }
}

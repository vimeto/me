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
 * Intuition: round-to-nearest on a scalar weight w (expressed in grid units)
 * flips to a different grid level when the error-feedback perturbation pushes
 * w across the nearest half-integer boundary. If the perturbation e is
 * approximately Gaussian with std σ (also in grid units), the per-weight flip
 * probability is
 *   p_flip(w) = 2 * (1 - Φ(d(w) / σ))
 * where d(w) is the distance from w to the nearest half-integer boundary.
 *
 * The "flipping range" is the set {w : p_flip(w) ≥ threshold}.
 */
export const gptqFlippingRange: ComputeFn = (params) => {
  const bits = Math.round(asNumber(params, 'bits', 3))
  const sigma = Math.max(1e-4, asNumber(params, 'sigma', 0.25))
  const threshold = Math.min(0.99, Math.max(0.01, asNumber(params, 'threshold', 0.3)))
  const range = Math.max(1, asNumber(params, 'range', 3))
  const levels = Math.pow(2, bits)

  const samples = 321
  const points = []
  let flipRangeCount = 0
  for (let i = 0; i < samples; i++) {
    const w = -range + (2 * range * i) / (samples - 1)
    const frac = w - Math.floor(w)
    const d = Math.abs(frac - 0.5)
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
      { label: 'Noise σ (grid units)', value: sigma.toFixed(3) },
      { label: 'Flipping range', value: `${(flipFraction * 100).toFixed(1)}%` },
    ],
  }
}

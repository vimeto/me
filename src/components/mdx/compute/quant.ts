import type { ComputeFn, ComputeParams } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function safe(y: number): number {
  return Number.isFinite(y) ? y : 0
}

/**
 * Round-to-nearest (RTN) quantization error.
 *
 * Pick a symmetric range [-R, R] and map it to a grid of 2^bits levels
 * via a scalar scale s = R / (2^(bits-1) - 1). The quantizer is
 *   q(w) = s * round(w / s),
 * and the pointwise error is e(w) = q(w) - w. The envelope of |e(w)| is
 * s/2 everywhere inside the representable range and grows linearly once
 * |w| exceeds R (clipping error dominates).
 *
 * A slider on `clipFrac` controls where R sits relative to the weight
 * magnitude shown, so the reader can watch the trade-off between
 * rounding resolution (small s) and clipping damage (small R).
 */
export const quantRtnError: ComputeFn = (params) => {
  const bits = Math.max(2, Math.round(asNumber(params, 'bits', 4)))
  const wMax = Math.max(0.1, asNumber(params, 'wMax', 1))
  const clipFrac = Math.min(1, Math.max(0.2, asNumber(params, 'clipFrac', 1)))

  const R = wMax * clipFrac
  const levels = Math.pow(2, bits)
  const half = Math.pow(2, bits - 1) - 1
  const s = R / Math.max(1, half)

  const samples = 361
  const points: Array<{ x: number; y: number }> = []
  let sumSq = 0
  let maxAbs = 0
  for (let i = 0; i < samples; i++) {
    const w = -wMax + (2 * wMax * i) / (samples - 1)
    const clamped = Math.max(-R, Math.min(R, w))
    const q = s * Math.round(clamped / s)
    const e = safe(q - w)
    const absE = Math.abs(e)
    if (absE > maxAbs) maxAbs = absE
    sumSq += e * e
    points.push({ x: w, y: e })
  }
  const rmse = Math.sqrt(sumSq / samples)

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = [
    { type: 'hline', y: s / 2, label: `± s/2 = ±${(s / 2).toFixed(3)}` },
    { type: 'hline', y: -s / 2 },
  ]
  if (clipFrac < 1) {
    annotations.push({ type: 'band', from: R, to: wMax, axis: 'x', label: 'clipping' })
    annotations.push({ type: 'band', from: -wMax, to: -R, axis: 'x' })
  }

  const yBound = Math.max(s, maxAbs) * 1.1

  return {
    points,
    xDomain: [-wMax, wMax],
    yDomain: [-yBound, yBound],
    annotations,
    summary: [
      { label: 'Levels (2^bits)', value: String(levels) },
      { label: 'Step size s', value: s.toFixed(4) },
      { label: 'Max |error|', value: maxAbs.toFixed(4) },
      { label: 'RMSE', value: rmse.toFixed(4) },
    ],
  }
}

/**
 * GPTQ error-feedback intuition.
 *
 * We quantize weights left-to-right for a single "row" whose output is
 *   y = Σ_i w_i · x_i
 * under uncorrelated inputs (the toy Hessian is identity-scaled). The
 * quantity that matters is the *output* error, Σ_i r_i · x_i, not the
 * per-weight residual. Under E[x x^T] = I, this simplifies to Σ_i r_i
 * (signed cumulative residual).
 *
 *   - RTN: residuals are independent; |Σ r_i| is a random walk that
 *     grows as √n.
 *   - GPTQ: after quantizing w_i, push ρ · r_i onto w_{i+1}. At ρ = 1
 *     residuals telescope — the cumulative output error stays bounded
 *     by one grid step regardless of n. At ρ = 0 we recover RTN.
 *
 * This is the OBS update specialised to a tridiagonal inverse Hessian
 * (AR(1)-style coupling); the real paper applies the full Cholesky-
 * factored update. The stylised "feedback strength ρ" makes the
 * trade-off visible without introducing a matrix.
 */
export const quantGptqFeedback: ComputeFn = (params) => {
  const bits = Math.max(2, Math.round(asNumber(params, 'bits', 4)))
  const rho = Math.min(1, Math.max(0, asNumber(params, 'rho', 0.7)))
  const n = Math.max(20, Math.round(asNumber(params, 'n', 120)))
  const trials = Math.max(1, Math.round(asNumber(params, 'trials', 64)))

  function rand(i: number, seed: number): number {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
    return 2 * (x - Math.floor(x)) - 1
  }

  const half = Math.pow(2, bits - 1) - 1
  const s = 1 / Math.max(1, half)

  // Accumulate sum-of-squares over `trials` independent seeds so the
  // plotted line is the RMS expected magnitude |Σ v_i|, not one lucky
  // random walk. RTN's RMS grows as √i · s / √12; GPTQ's (with ρ = 1)
  // stays bounded by s / 2.
  const rtnSq = new Array<number>(n).fill(0)
  const gptqSq = new Array<number>(n).fill(0)

  for (let t = 0; t < trials; t++) {
    const seed = t + 1
    const wBase = new Array<number>(n)
    for (let i = 0; i < n; i++) wBase[i] = rand(i, seed)

    // RTN
    let rtnOut = 0
    for (let i = 0; i < n; i++) {
      const q = s * Math.round(wBase[i] / s)
      rtnOut += q - wBase[i]
      rtnSq[i] += rtnOut * rtnOut
    }

    // GPTQ
    const w = wBase.slice()
    let gptqOut = 0
    for (let i = 0; i < n; i++) {
      const q = s * Math.round(w[i] / s)
      const r = q - w[i]
      gptqOut += q - wBase[i]
      gptqSq[i] += gptqOut * gptqOut
      if (i + 1 < n) w[i + 1] = w[i + 1] - rho * r
    }
  }

  const rtnRms = rtnSq.map((v) => Math.sqrt(v / trials))
  const gptqRms = gptqSq.map((v) => Math.sqrt(v / trials))

  const points: Array<{ x: number; y: number; series?: string }> = []
  for (let i = 0; i < n; i++) points.push({ x: i + 1, y: safe(rtnRms[i]), series: 'RTN' })
  for (let i = 0; i < n; i++) points.push({ x: i + 1, y: safe(gptqRms[i]), series: 'GPTQ' })

  const finalRtn = rtnRms[n - 1]
  const finalGptq = gptqRms[n - 1]
  const gain = finalRtn > 0 ? (1 - finalGptq / finalRtn) * 100 : 0

  return {
    points,
    seriesKeys: ['RTN', 'GPTQ'],
    xDomain: [1, n],
    annotations: [{ type: 'hline', y: s / 2, label: `one grid step / 2 = ${(s / 2).toFixed(3)}` }],
    summary: [
      { label: 'Weights swept', value: String(n) },
      { label: 'Feedback ρ', value: rho.toFixed(2) },
      { label: 'RTN RMS |Σv|', value: finalRtn.toFixed(4) },
      {
        label: 'GPTQ RMS |Σv|',
        value: `${finalGptq.toFixed(4)} (${gain >= 0 ? '−' : '+'}${Math.abs(gain).toFixed(1)}%)`,
      },
    ],
  }
}

/**
 * SmoothQuant activation rescaling.
 *
 * Activations in LLM forward passes have a handful of outlier channels
 * whose magnitudes are 10-100× the median. Per-tensor RTN on the
 * activations must pick a scale large enough to cover the outlier, and
 * the useful channels end up living in one or two grid levels.
 *
 * SmoothQuant migrates magnitude from activations to weights:
 *   X' = X / diag(m),  W' = diag(m) * W.
 * The paper's Eq. 4 uses m_j = max|X_j|^α / max|W_j|^(1-α). For the
 * pedagogical plot we use the simpler equivalent-in-spirit form
 *   m_j = (max|X_j| / max|W_j|)^α
 * so α = 0 reads as "no migration" (m = 1) and α = 1 reads as "push all
 * activation outliers onto weights" — matching the prose intuition.
 *
 * We plot the *effective dynamic range* ratio
 *   (max / median) for X' and for W'
 * as a function of α, across a synthetic distribution that mixes a
 * bulk Gaussian with a few spiked channels.
 */
export const quantSmoothquantRescale: ComputeFn = (params) => {
  const alphaShown = Math.min(1, Math.max(0, asNumber(params, 'alpha', 0.5)))
  const spike = Math.max(1, asNumber(params, 'spike', 30))
  const nSpikes = Math.max(1, Math.round(asNumber(params, 'nSpikes', 3)))
  const n = 128

  // Synthetic channel magnitudes: Gaussian-ish bulk plus a few outliers.
  // Weights have a mild tail (a couple of channels ~3× the bulk) to match
  // what real weight distributions look like — enough range to make the
  // crossover story visible without dominating the plot.
  const xMag = new Array<number>(n)
  const wMag = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const ux = Math.abs(Math.sin(i * 1.7 + 0.3)) // [0, 1]
    const uw = Math.abs(Math.sin(i * 2.1 + 1.1))
    xMag[i] = 0.5 + ux
    wMag[i] = 0.5 + uw
  }

  function median(arr: number[]): number {
    const a = arr.slice().sort((p, q) => p - q)
    const m = a.length
    return m % 2 ? a[(m - 1) / 2] : 0.5 * (a[m / 2 - 1] + a[m / 2])
  }

  // Normalise the bulk so median(bulk) = 1 before placing outliers, so the
  // slider's "outlier × median" label is literal: max/median equals spike.
  const xBulkMed = Math.max(1e-6, median(xMag))
  const wBulkMed = Math.max(1e-6, median(wMag))
  for (let i = 0; i < n; i++) {
    xMag[i] /= xBulkMed
    wMag[i] /= wBulkMed
  }
  for (let k = 0; k < nSpikes; k++) {
    const idx = Math.floor((k + 0.5) * (n / nSpikes))
    xMag[idx] = spike
  }
  // A couple of modest weight outliers at fixed offsets so there's some
  // weight range to redistribute into. Kept well below the activation
  // spikes so the narrative "activations are the hard side" still holds.
  for (const idx of [7, 41, 83]) {
    if (idx < n) wMag[idx] = 3
  }

  function rangeRatio(arr: number[]): number {
    const mx = Math.max.apply(null, arr)
    const med = Math.max(1e-6, median(arr))
    return mx / med
  }

  const samples = 201
  const points: Array<{ x: number; y: number; series?: string }> = []
  let xShown = 0
  let wShown = 0
  for (let i = 0; i < samples; i++) {
    const alpha = i / (samples - 1)
    const mVec = new Array<number>(n)
    const xNew = new Array<number>(n)
    const wNew = new Array<number>(n)
    for (let c = 0; c < n; c++) {
      const ratio = xMag[c] / Math.max(1e-6, wMag[c])
      const m = Math.pow(ratio, alpha)
      mVec[c] = m
      xNew[c] = xMag[c] / m
      wNew[c] = wMag[c] * m
    }
    const xr = rangeRatio(xNew)
    const wr = rangeRatio(wNew)
    points.push({ x: alpha, y: safe(xr), series: 'activations' })
    points.push({ x: alpha, y: safe(wr), series: 'weights' })
    if (Math.abs(alpha - alphaShown) < 1 / samples) {
      xShown = xr
      wShown = wr
    }
  }

  return {
    points,
    seriesKeys: ['activations', 'weights'],
    xDomain: [0, 1],
    annotations: [{ type: 'vline', x: alphaShown, label: `α = ${alphaShown.toFixed(2)}` }],
    summary: [
      { label: 'Outlier spike ×', value: spike.toFixed(0) },
      { label: 'Spiked channels', value: String(nSpikes) },
      { label: 'Act. range @α', value: xShown.toFixed(1) },
      { label: 'Weight range @α', value: wShown.toFixed(1) },
    ],
  }
}

/**
 * AWQ salience protection.
 *
 * Activation-aware Weight Quantization observes that the error a weight
 * w_ij contributes to the output scales with the input activation x_j.
 * A tiny fraction of channels (~1%) carries most of the importance.
 * AWQ leaves those channels at higher precision (or gives them a larger
 * per-channel scale so their rounding step is smaller) and quantizes
 * the rest aggressively.
 *
 * We model channel salience as a Pareto-ish distribution
 *   s_i ∝ 1 / (i + 1)^β
 * and plot the *protected fraction of total salience* captured as we
 * include the top α% of channels. A slider picks α.
 */
export const quantAwqSalience: ComputeFn = (params) => {
  const beta = Math.max(0.2, asNumber(params, 'beta', 1.1))
  const alphaPct = Math.min(50, Math.max(0.1, asNumber(params, 'alpha', 1)))
  const n = 400

  const s = new Array<number>(n)
  let total = 0
  for (let i = 0; i < n; i++) {
    const v = 1 / Math.pow(i + 1, beta)
    s[i] = v
    total += v
  }

  const points: Array<{ x: number; y: number }> = []
  let cum = 0
  let alphaY = 0
  const alphaFrac = alphaPct / 100
  for (let i = 0; i < n; i++) {
    cum += s[i]
    const xFrac = (i + 1) / n
    const y = cum / total
    points.push({ x: xFrac * 100, y: safe(y) })
    if (xFrac <= alphaFrac) alphaY = y
  }

  // Also find the channel share needed to capture 90% of salience.
  let nFor90 = n
  let acc = 0
  for (let i = 0; i < n; i++) {
    acc += s[i]
    if (acc / total >= 0.9) {
      nFor90 = i + 1
      break
    }
  }

  return {
    points,
    xDomain: [0, 100],
    yDomain: [0, 1],
    annotations: [
      { type: 'vline', x: alphaPct, label: `top ${alphaPct.toFixed(1)}%` },
      { type: 'hline', y: alphaY, label: `${(alphaY * 100).toFixed(1)}% salience` },
      { type: 'band', from: 0, to: alphaPct, axis: 'x', label: 'protected' },
    ],
    summary: [
      { label: 'Pareto exponent β', value: beta.toFixed(2) },
      { label: 'Protected channels', value: `${alphaPct.toFixed(1)}%` },
      { label: 'Captured salience', value: `${(alphaY * 100).toFixed(1)}%` },
      { label: 'Channels for 90%', value: `${((nFor90 / n) * 100).toFixed(1)}%` },
    ],
  }
}

/**
 * Memory/bandwidth math for a dense decoder LLM.
 *
 * A single forward token on a dense transformer reads all weights from
 * HBM into compute once. At parameter count P and bit-width b,
 *   bytes_per_token = P * b / 8
 * and the time to move those bytes over a memory bus with bandwidth B
 * is P * b / (8 * B). For a 70B-param model on an 80 GB/s laptop SSD
 * → HBM link, int4 is the difference between "unusable" and "usable".
 *
 * This compute sweeps bit width and plots bytes-read-per-token (GB)
 * and the implied memory-bound tokens/sec at a fixed bandwidth.
 */
export const quantMemoryMath: ComputeFn = (params) => {
  const paramsB = Math.max(0.5, asNumber(params, 'paramsB', 70)) // billions
  const bandwidthGBs = Math.max(1, asNumber(params, 'bandwidthGBs', 800))

  const samples = 121
  const points: Array<{ x: number; y: number; series?: string }> = []
  const bitsShown = Math.max(1, Math.round(asNumber(params, 'bits', 4)))
  let gbAtShown = 0
  let tpsAtShown = 0
  for (let i = 0; i < samples; i++) {
    const bits = 1 + (15 * i) / (samples - 1) // 1..16
    const gbPerToken = (paramsB * 1e9 * bits) / 8 / 1e9
    const tps = bandwidthGBs / gbPerToken
    points.push({ x: bits, y: safe(gbPerToken), series: 'GB / token' })
    points.push({ x: bits, y: safe(tps), series: 'tokens / sec' })
    if (Math.abs(bits - bitsShown) < 0.1) {
      gbAtShown = gbPerToken
      tpsAtShown = tps
    }
  }

  return {
    points,
    seriesKeys: ['GB / token', 'tokens / sec'],
    xDomain: [1, 16],
    annotations: [{ type: 'vline', x: bitsShown, label: `${bitsShown}-bit` }],
    summary: [
      { label: 'Model size', value: `${paramsB.toFixed(0)} B params` },
      { label: 'Bandwidth', value: `${bandwidthGBs.toFixed(0)} GB/s` },
      { label: `@ ${bitsShown}-bit`, value: `${gbAtShown.toFixed(1)} GB/token` },
      { label: `Ceiling`, value: `${tpsAtShown.toFixed(1)} tok/s` },
    ],
  }
}

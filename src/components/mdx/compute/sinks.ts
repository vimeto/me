import type { ComputeFn, ComputeParams, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// Seeded RNG so plots are deterministic as sliders move.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randn(rng: () => number): number {
  // Box-Muller. Clamp to avoid log(0).
  const u1 = Math.max(1e-12, rng())
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// Numerically stable softmax.
function softmax(z: number[], tau = 1): number[] {
  if (z.length === 0) return []
  const scaled = z.map((x) => x / Math.max(1e-6, tau))
  const m = Math.max(...scaled)
  const ex = scaled.map((x) => Math.exp(x - m))
  const s = ex.reduce((a, b) => a + b, 0) || 1
  return ex.map((v) => v / s)
}

// ReLU-normalised attention: z^+ / Σ z^+. Falls back to all-zero if every
// pre-activation is non-positive (intentionally not a distribution — that's
// the point of the counter-example).
function reluNorm(z: number[]): number[] {
  const pos = z.map((x) => Math.max(0, x))
  const s = pos.reduce((a, b) => a + b, 0)
  if (s <= 0) return pos.map(() => 0)
  return pos.map((v) => v / s)
}

// Sigmoid attention: σ(z), element-wise, no sum-to-one constraint.
function sigmoidAttn(z: number[]): number[] {
  return z.map((x) => 1 / (1 + Math.exp(-x)))
}

/**
 * Plot 1 — the shape of attention under four normalisations.
 *
 * Generate a synthetic query-key dot-product vector of length seqLen with a
 * controlled outlier spike at position 0 (magnitude `outlier`) and the rest
 * drawn from a zero-mean Gaussian. Run four normalisations over it:
 *   - softmax (τ = 1)
 *   - softmax (user τ)
 *   - ReLU-normalised (z^+ / Σ z^+)
 *   - sigmoid (σ(z), no normalisation)
 * Return one series per normalisation, y-axis is the attention mass given
 * to each position on the x-axis.
 */
export const sinksNormalizationShape: ComputeFn = (params) => {
  const seqLen = Math.max(8, Math.min(256, Math.round(asNumber(params, 'seqLen', 64))))
  const outlier = asNumber(params, 'outlier', 2)
  const tau = Math.max(0.1, asNumber(params, 'tau', 0.6))
  const noise = Math.max(0.1, asNumber(params, 'noise', 1))

  const rng = mulberry32(seqLen * 1000 + Math.round(outlier * 100) + Math.round(tau * 100))
  const z: number[] = new Array(seqLen)
  for (let i = 0; i < seqLen; i++) z[i] = randn(rng) * noise
  z[0] = z[0] + outlier

  const sSoft = softmax(z, 1)
  const sSoftTau = softmax(z, tau)
  const sRelu = reluNorm(z)
  const sSig = sigmoidAttn(z)

  const points: Point[] = []
  for (let i = 0; i < seqLen; i++) {
    points.push({ x: i, y: sSoft[i], series: 'softmax (τ=1)' })
    points.push({ x: i, y: sSoftTau[i], series: 'softmax (τ)' })
    points.push({ x: i, y: sRelu[i], series: 'ReLU-norm' })
    points.push({ x: i, y: sSig[i], series: 'sigmoid' })
  }

  const massSoft0 = sSoft[0]
  const massRelu0 = sRelu[0]
  const massSig0 = sSig[0]

  return {
    points,
    seriesKeys: ['softmax (τ=1)', 'softmax (τ)', 'ReLU-norm', 'sigmoid'],
    xDomain: [0, seqLen - 1],
    annotations: [{ type: 'vline', x: 0, label: 'outlier / parking spot' }],
    summary: [
      { label: 'softmax mass @ pos 0', value: `${(massSoft0 * 100).toFixed(1)}%` },
      { label: 'ReLU-norm mass @ pos 0', value: `${(massRelu0 * 100).toFixed(1)}%` },
      { label: 'sigmoid value @ pos 0', value: massSig0.toFixed(3) },
      { label: 'Σ softmax', value: sSoft.reduce((a, b) => a + b, 0).toFixed(3) },
      { label: 'Σ ReLU-norm', value: sRelu.reduce((a, b) => a + b, 0).toFixed(3) },
    ],
  }
}

/**
 * Plot 2 — sink mass as the rest of the sequence stops matching.
 *
 * Sweep a "mean query-key similarity" for positions 1..seqLen-1 from low to
 * high. Position 0 is held at a fixed small positive value (a stable
 * anchor). For each setting we compute softmax / ReLU-norm / sigmoid mass at
 * position 0. Under softmax, as the other positions get less match-worthy,
 * mass at 0 rises toward ~1 (the parking-spot effect). ReLU stays near zero
 * once the other positions are positive. Sigmoid tracks σ(z_0) directly and
 * doesn't care about the rest.
 */
export const sinksSinkMass: ComputeFn = (params) => {
  const seqLen = Math.max(8, Math.min(256, Math.round(asNumber(params, 'seqLen', 64))))
  const variance = Math.max(0.05, asNumber(params, 'variance', 1))
  const anchor = asNumber(params, 'anchor', 0.5)
  const trials = Math.max(4, Math.min(128, Math.round(asNumber(params, 'trials', 32))))

  const samples = 81
  const points: Point[] = []

  for (let i = 0; i < samples; i++) {
    const mu = -2 + (6 * i) / (samples - 1) // sweep mean similarity from -2 to +4
    let softSum = 0
    let reluSum = 0
    let sigSum = 0
    for (let t = 0; t < trials; t++) {
      const rng = mulberry32(seqLen * 7919 + i * 131 + t * 17 + Math.round(variance * 1000))
      const z: number[] = new Array(seqLen)
      z[0] = anchor
      for (let k = 1; k < seqLen; k++) z[k] = mu + randn(rng) * variance
      const sSoft = softmax(z, 1)
      const sRelu = reluNorm(z)
      const sSig = sigmoidAttn(z)
      softSum += sSoft[0]
      reluSum += sRelu[0]
      sigSum += sSig[0]
    }
    points.push({ x: mu, y: softSum / trials, series: 'softmax' })
    points.push({ x: mu, y: reluSum / trials, series: 'ReLU-norm' })
    points.push({ x: mu, y: sigSum / trials, series: 'sigmoid' })
  }

  return {
    points,
    seriesKeys: ['softmax', 'ReLU-norm', 'sigmoid'],
    xDomain: [-2, 4],
    yDomain: [0, 1],
    annotations: [
      { type: 'vline', x: 0, label: 'others match at random' },
      { type: 'hline', y: 1 / seqLen, label: '1/N (uniform share)' },
    ],
    summary: [
      { label: 'Sequence length', value: String(seqLen) },
      { label: 'Anchor logit z₀', value: anchor.toFixed(2) },
      { label: 'Trials per point', value: String(trials) },
      {
        label: 'Mechanism',
        value: 'softmax parks slack on z₀; ReLU zeros out once rest is positive',
      },
    ],
  }
}

/**
 * Plot 3 — streaming stability under a KV-cache budget.
 *
 * Three conditions:
 *   (a) softmax + sink retained: first `sinkTokens` positions always kept.
 *   (b) softmax + naïve sliding window: only the last `budget` positions kept.
 *   (c) ReLU attention + no sinks: only the last `budget` positions kept.
 *
 * We track a perplexity surrogate over position. Model: each output token's
 * "log-loss" is the negative log of a match probability that depends on how
 * well the kept attention distribution concentrates on the right key. When
 * softmax loses the early tokens it used as sinks, mass has to redistribute
 * across the remaining positions, pushing per-position probability down and
 * loss up. ReLU has no such dependence — if the true key is in-window, the
 * distribution concentrates on it; if not, the output is zero (we floor the
 * log-loss).
 */
export const sinksStreamingStability: ComputeFn = (params) => {
  const contextLen = Math.max(64, Math.min(4096, Math.round(asNumber(params, 'contextLen', 1024))))
  const budget = Math.max(16, Math.min(contextLen, Math.round(asNumber(params, 'budget', 256))))
  const sinkTokens = Math.max(0, Math.min(16, Math.round(asNumber(params, 'sinkTokens', 4))))

  // Sample 120 positions evenly across the context.
  const samples = 120
  const points: Point[] = []

  // Baseline: in-window loss (how well a softmax/ReLU model matches when all
  // relevant tokens are present). We use a target loss ~ 2.0 nats for a
  // working model. Adjust upwards as window fills / empties.
  const baseLoss = 2.0
  // Leak: how much softmax loses per missing sink-token's worth of mass.
  // When the first `sinkTokens` are dropped, softmax re-spreads mass across
  // the remaining ~budget positions, costing roughly log((budget+sinkTokens)/budget).
  const softmaxSinkLeak = Math.log((budget + sinkTokens) / Math.max(1, budget))

  for (let i = 0; i < samples; i++) {
    const pos = Math.round((contextLen * i) / (samples - 1))

    // (a) softmax + sinks kept: flat, close to baseLoss as long as we're
    // inside a valid context (we always are).
    const lossSinkKept = baseLoss

    // (b) softmax + naïve sliding window (sinks get dropped once pos > budget).
    // Penalty ramps up logarithmically until the window is past the original
    // sinks (pos > budget), at which point it hits the softmaxSinkLeak ceiling
    // plus a small streaming penalty that grows with how far past the initial
    // sinks we've drifted.
    const past = Math.max(0, pos - budget)
    const streamingPenalty = 0.35 * Math.log(1 + past / Math.max(1, budget))
    const lossSlide = baseLoss + softmaxSinkLeak + streamingPenalty * (sinkTokens > 0 ? 1 : 0)

    // (c) ReLU attention, no sinks needed. Loss stays flat as long as
    // relevant keys fit in the budget. We assume the "real" context the
    // model needs is ≤ budget, so this is constant; it degrades only when
    // the actual dependency is longer than budget (not modelled here).
    const lossRelu = baseLoss

    points.push({ x: pos, y: lossSinkKept, series: 'softmax + sinks kept' })
    points.push({ x: pos, y: lossSlide, series: 'softmax + naïve window' })
    points.push({ x: pos, y: lossRelu, series: 'ReLU (no sink needed)' })
  }

  return {
    points,
    seriesKeys: ['softmax + sinks kept', 'softmax + naïve window', 'ReLU (no sink needed)'],
    xDomain: [0, contextLen],
    annotations: [
      {
        type: 'vline',
        x: budget,
        label: `KV budget = ${budget}`,
      },
    ],
    summary: [
      { label: 'Context length', value: String(contextLen) },
      { label: 'KV budget', value: String(budget) },
      { label: 'Sink tokens retained', value: String(sinkTokens) },
      {
        label: 'Softmax sink-drop penalty',
        value: `${softmaxSinkLeak.toFixed(3)} nats`,
      },
    ],
  }
}

/**
 * Plot 4 — sink emergence during training (closed-form proxy).
 *
 * Too expensive to run a real transformer here; instead we use a closed-form
 * analogue of the ICLR 2025 finding. Consider a single attention head with
 * logits z ∈ R^N where position 0 is initialised at 0. The loss encourages
 * the output to match a target: for softmax attention on a trigger-free
 * input, the minimising choice is the null distribution (uniform / any
 * stable anchor). Because softmax normalises, gradient descent on a loss
 * that wants "output ≈ 0 on non-trigger inputs" pushes z_0 up relative to
 * the others (the "keep mass on a fixed anchor" solution), at a rate
 * proportional to the temperature and the optimisation budget.
 *
 * For ReLU-normalised attention, the same loss admits a cleaner solution:
 * set all z_k ≤ 0 so the output is zero. No anchor needed. We track the
 * attention mass placed on position 0 over training steps, for three
 * normalisations (softmax τ=1, softmax τ low, sigmoid, ReLU-norm).
 */
export const sinksSinkEmergence: ComputeFn = (params) => {
  const steps = Math.max(50, Math.min(4000, Math.round(asNumber(params, 'steps', 600))))
  const datasetSize = Math.max(
    50,
    Math.min(10000, Math.round(asNumber(params, 'datasetSize', 1000)))
  )
  const tau = Math.max(0.1, asNumber(params, 'tau', 1))
  const seqLen = Math.max(8, Math.min(128, Math.round(asNumber(params, 'seqLen', 32))))

  const lr = 0.05
  // Effective optimisation pressure — more data per step means faster
  // emergence (bigger signal, smaller per-example noise).
  const pressure = Math.sqrt(datasetSize / 500) / Math.max(0.1, tau)

  const samples = 120
  const points: Point[] = []

  // Softmax: z_0 rises roughly logarithmically; mass @ 0 → 1 as z_0 − max(z_rest) grows.
  // Closed-form approximation z_0(t) ≈ log(1 + c · t · pressure), z_rest(t) ≈ 0.
  // So mass_0(t) ≈ exp(z_0/τ) / (exp(z_0/τ) + (N-1)).
  //
  // Softmax (low τ) uses the same recipe but with a different temperature in
  // the normalisation, so emergence is faster.
  //
  // ReLU-norm: there's no attraction to a fixed anchor. The optimiser drives
  // all z_k to 0 (or below) and the output is zero; mass @ 0 stays at ≈ 1/N
  // (or 0) throughout training.
  //
  // Sigmoid: σ(z_0). With no sum-to-one constraint, the null solution is
  // z_k → -∞ for all k. Mass @ 0 drops to 0.

  const tauHigh = tau
  const tauLow = 0.4 * tau

  for (let i = 0; i < samples; i++) {
    const t = Math.round((steps * i) / (samples - 1))
    const driveHigh = Math.log(1 + lr * t * pressure)
    const driveLow = Math.log(1 + lr * t * pressure * 1.8)
    const mSoftHi = Math.exp(driveHigh / tauHigh) / (Math.exp(driveHigh / tauHigh) + (seqLen - 1))
    const mSoftLo = Math.exp(driveLow / tauLow) / (Math.exp(driveLow / tauLow) + (seqLen - 1))
    const mRelu = 1 / seqLen // uniform by default; no attraction
    // Sigmoid decays: σ(-lr·t·pressure) → 0
    const mSig = 1 / (1 + Math.exp(lr * t * pressure))

    points.push({ x: t, y: mSoftHi, series: `softmax τ=${tauHigh.toFixed(2)}` })
    points.push({ x: t, y: mSoftLo, series: `softmax τ=${tauLow.toFixed(2)}` })
    points.push({ x: t, y: mRelu, series: 'ReLU-norm' })
    points.push({ x: t, y: mSig, series: 'sigmoid' })
  }

  // Threshold crossings for softmax τ=1 series.
  let sinkStep: number | null = null
  for (const p of points) {
    if (p.series === `softmax τ=${tauHigh.toFixed(2)}` && p.y > 0.5 && sinkStep === null) {
      sinkStep = p.x
    }
  }

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = [{ type: 'hline', y: 0.5, label: 'sink threshold (50%)' }]
  if (sinkStep !== null) {
    annotations.push({
      type: 'vline',
      x: sinkStep,
      label: `softmax crosses 50% ≈ step ${sinkStep}`,
    })
  }

  return {
    points,
    seriesKeys: [
      `softmax τ=${tauHigh.toFixed(2)}`,
      `softmax τ=${tauLow.toFixed(2)}`,
      'ReLU-norm',
      'sigmoid',
    ],
    xDomain: [0, steps],
    yDomain: [0, 1],
    annotations,
    summary: [
      { label: 'Training steps', value: String(steps) },
      { label: 'Dataset size', value: String(datasetSize) },
      { label: 'Sequence length', value: String(seqLen) },
      {
        label: 'Proxy',
        value: 'closed-form stand-in for an attention-only training loop',
      },
    ],
  }
}

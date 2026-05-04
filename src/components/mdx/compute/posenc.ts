import type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * posenc.attnVsOffset
 *
 * Mean query-key similarity as a function of relative offset m, overlaid for
 * four positional schemes. Assume q = k before any positional handling, so the
 * "pre-position" dot product is 1 and any shape you see is purely the effect
 * of the positional scheme.
 *
 *   RoPE:    s(m) = (2/d) Σ_i cos(m · θ_i),  θ_i = b^(-2i/d)
 *   NoPE:    s(m) = 1 (no positional modulation, constant)
 *   ALiBi:   s(m) = 1 − slope · m  (logit bias, softmaxed elsewhere; plotted
 *            as a linear decay with a floor at 0 for visual parity with the
 *            other schemes)
 *   RoPE + QK-Norm: RoPE similarity rescaled by a QK-Norm factor in (0, 1]
 *
 * Generalises `archRopeSimilarity` (same RoPE math, more series). Annotates
 * the first-zero crossing for RoPE.
 */
export const posencAttnVsOffset: ComputeFn = (params): ComputeResult => {
  const dim = Math.max(4, Math.round(asNumber(params, 'dim', 64)))
  const base = Math.max(10, asNumber(params, 'base', 10000))
  const alibiSlope = Math.max(0, asNumber(params, 'alibiSlope', 0.0015))
  const qkNormScale = Math.max(0.1, Math.min(1, asNumber(params, 'qkNormScale', 0.7)))
  const maxOffset = Math.max(16, asNumber(params, 'maxOffset', 2048))

  const d = dim % 2 === 0 ? dim : dim - 1
  const half = d / 2
  const thetas: number[] = []
  for (let i = 0; i < half; i++) {
    thetas.push(Math.pow(base, (-2 * i) / d))
  }

  const samples = 321
  const points: Point[] = []
  let firstZero: number | null = null
  for (let i = 0; i < samples; i++) {
    const m = (maxOffset * i) / (samples - 1)
    let acc = 0
    for (let k = 0; k < half; k++) acc += Math.cos(m * thetas[k])
    const rope = acc / half
    if (firstZero === null && i > 0 && rope <= 0) firstZero = m
    const nope = 1
    const alibi = Math.max(0, 1 - alibiSlope * m)
    const ropeQk = rope * qkNormScale
    points.push({ x: m, y: rope, series: 'RoPE' })
    points.push({ x: m, y: nope, series: 'NoPE' })
    points.push({ x: m, y: alibi, series: 'ALiBi' })
    points.push({ x: m, y: ropeQk, series: 'RoPE + QK-Norm' })
  }

  const annotations: NonNullable<ComputeResult['annotations']> = [
    { type: 'hline', y: 0, label: 'zero coherence' },
  ]
  if (firstZero !== null) {
    annotations.push({
      type: 'vline',
      x: firstZero,
      label: `RoPE first zero ≈ ${firstZero.toFixed(0)} tok`,
    })
  }

  return {
    points,
    seriesKeys: ['RoPE', 'NoPE', 'ALiBi', 'RoPE + QK-Norm'],
    xDomain: [0, maxOffset],
    yDomain: [-0.5, 1.05],
    annotations,
    summary: [
      { label: 'Head dim', value: String(d) },
      { label: 'RoPE base b', value: base.toFixed(0) },
      { label: 'ALiBi slope', value: alibiSlope.toExponential(2) },
      { label: 'QK-Norm scale', value: qkNormScale.toFixed(2) },
    ],
  }
}

/**
 * posenc.extrapolationGap
 *
 * Perplexity-surrogate vs inference position, for a model "trained to length
 * L_train", under four schemes: RoPE, NoPE, YaRN-scaled RoPE, and the hybrid.
 *
 * Shape assumptions:
 *   RoPE:  flat-ish up to L_train, then a cliff (unseen angles).
 *   NoPE:  flat everywhere, but with a constant intrinsic penalty in the
 *          training range (no positional signal to anchor on).
 *   YaRN:  pushes the cliff out to ~2–4× L_train by stretching low-freq bands.
 *   Hybrid (RoPE + NoPE layers): inherits RoPE's in-range behaviour and
 *          NoPE's graceful degradation.
 *
 * The penalty curves are hand-picked softplus cliffs. Numbers are illustrative,
 * not calibrated perplexities.
 */
export const posencExtrapolationGap: ComputeFn = (params): ComputeResult => {
  const lTrain = Math.max(256, asNumber(params, 'lTrain', 8192))
  const lInfer = Math.max(lTrain + 256, asNumber(params, 'lInfer', 131072))
  const nopePenalty = Math.max(0, asNumber(params, 'nopePenalty', 0.35))
  const yarnScale = Math.max(1, asNumber(params, 'yarnScale', 4))

  const samples = 241
  // Softplus cliff: smoothly transitions from ~0 below x0 to a linear regime
  // above. `sharpness` controls the knee width.
  const cliff = (x: number, x0: number, sharpness: number, slope: number) => {
    const z = sharpness * (x / x0 - 1)
    // Numerically stable softplus.
    const sp = z > 20 ? z : Math.log1p(Math.exp(z))
    return (slope * x0 * sp) / sharpness
  }

  const points: Point[] = []
  let ropeAtEnd = 0
  let hybridAtEnd = 0
  for (let i = 0; i < samples; i++) {
    const m = (lInfer * i) / (samples - 1)
    // Each scheme: base PPL-surrogate of 1.0 when "in training range with
    // useful positions", plus a scheme-specific extra.
    const ropeY = 1 + cliff(m, lTrain, 8, 2.5)
    const nopeY = 1 + nopePenalty + cliff(m, lTrain * 2.5, 3, 0.4)
    const yarnY = 1 + 0.03 + cliff(m, lTrain * yarnScale, 6, 2.0)
    const hybridY = 1 + 0.04 + cliff(m, lTrain * (yarnScale + 1.5), 5, 1.0)
    points.push({ x: m, y: ropeY, series: 'RoPE' })
    points.push({ x: m, y: nopeY, series: 'NoPE' })
    points.push({ x: m, y: yarnY, series: 'YaRN-scaled RoPE' })
    points.push({ x: m, y: hybridY, series: 'RoPE + NoPE hybrid' })
    if (i === samples - 1) {
      ropeAtEnd = ropeY
      hybridAtEnd = hybridY
    }
  }

  const gainPct = ropeAtEnd > 0 ? ((ropeAtEnd - hybridAtEnd) / ropeAtEnd) * 100 : 0

  return {
    points,
    seriesKeys: ['RoPE', 'NoPE', 'YaRN-scaled RoPE', 'RoPE + NoPE hybrid'],
    xDomain: [0, lInfer],
    annotations: [
      { type: 'vline', x: lTrain, label: `L_train = ${lTrain.toFixed(0)}` },
      { type: 'hline', y: 1, label: 'in-distribution floor' },
    ],
    summary: [
      { label: 'L_train', value: lTrain.toFixed(0) },
      { label: 'L_infer', value: lInfer.toFixed(0) },
      { label: 'NoPE intrinsic penalty', value: nopePenalty.toFixed(2) },
      { label: 'YaRN effective stretch', value: `${yarnScale.toFixed(1)}×` },
      { label: 'Hybrid vs RoPE @ L_infer', value: `${gainPct.toFixed(0)}% lower` },
    ],
  }
}

/**
 * posenc.layerHybrid
 *
 * Long-context recall vs throughput Pareto, swept over the RoPE:NoPE layer
 * ratio r ∈ [0, 1]. r = 0 is pure NoPE, r = 1 is pure RoPE.
 *
 * Recall model:
 *   - Pure RoPE rolls off past the context length (positions drift out of
 *     trained phase). Pure NoPE has weaker in-range recall but no cliff.
 *   - The hybrid interpolates: at around r ≈ 0.75 (Cohere's 1:3 NoPE:RoPE
 *     placement) the recall curve has an interior optimum for long contexts.
 *     This is a toy model; the knee shape is hand-tuned to match the paper's
 *     qualitative finding.
 *
 * Throughput model:
 *   - Each RoPE layer pays a small per-layer cost (the extra rotation, plus
 *     KV-cache overhead because RoPE layers can't share positions the way
 *     NoPE layers can). Fewer RoPE layers → higher throughput.
 */
export const posencLayerHybrid: ComputeFn = (params): ComputeResult => {
  const ctx = Math.max(2048, asNumber(params, 'ctx', 65536))
  const ropeCost = Math.max(0, asNumber(params, 'ropeCost', 0.12))

  // Anchor context length at which the "pure RoPE" baseline starts rolling off.
  const lAnchor = 8192
  // How far past the anchor we're asking the model to recall.
  const stretch = Math.max(1, ctx / lAnchor)

  const samples = 101
  const points: Point[] = []
  let bestRecall = 0
  let bestR = 0
  let bestScore = -Infinity
  let bestScoreR = 0
  for (let i = 0; i < samples; i++) {
    const r = i / (samples - 1)
    // Recall model: NoPE contribution is stable but capped. RoPE contribution
    // decays with stretch. The interior knee comes from a small cross-term
    // (each scheme covers the other's blind spot).
    const nopeTerm = 0.55 * (1 - r)
    const ropeDecay = 1 / (1 + 0.25 * (stretch - 1) * r * r)
    const ropeTerm = 0.7 * r * ropeDecay
    const crossTerm = 0.35 * r * (1 - r) * (1 - 1 / stretch)
    const recall = Math.max(0, Math.min(1, nopeTerm + ropeTerm + crossTerm))
    // Throughput: pure NoPE is 1.0; each RoPE layer costs ropeCost.
    const throughput = 1 / (1 + ropeCost * r)
    // Composite score just for the annotation. Heuristic balance.
    const score = recall + 0.3 * throughput
    points.push({ x: r, y: recall, series: 'recall' })
    points.push({ x: r, y: throughput, series: 'throughput' })
    if (recall > bestRecall) {
      bestRecall = recall
      bestR = r
    }
    if (score > bestScore) {
      bestScore = score
      bestScoreR = r
    }
  }

  return {
    points,
    seriesKeys: ['recall', 'throughput'],
    xDomain: [0, 1],
    yDomain: [0, 1.05],
    annotations: [
      { type: 'vline', x: bestR, label: `recall peak @ r = ${bestR.toFixed(2)}` },
      { type: 'vline', x: 0.75, label: 'Cohere 1:3 (r = 0.75)' },
      {
        type: 'vline',
        x: bestScoreR,
        label: `composite peak @ r = ${bestScoreR.toFixed(2)}`,
      },
    ],
    summary: [
      { label: 'Context length', value: ctx.toFixed(0) },
      { label: 'Stretch vs anchor', value: `${stretch.toFixed(1)}×` },
      { label: 'RoPE per-layer cost', value: `${(ropeCost * 100).toFixed(0)}%` },
      { label: 'Recall-optimal r', value: bestR.toFixed(2) },
      { label: 'Paper placement', value: '1 NoPE : 3 RoPE (r = 0.75)' },
    ],
  }
}

/**
 * posenc.baseScaling
 *
 * Frequency spectrum of RoPE. For a head dim d and base b, each 2D subspace
 * i ∈ [0, d/2) rotates at θ_i = b^(-2i/d). Plot log10(θ_i) vs i.
 *
 * Overlay a "usable wavelengths" band: subspace i is "in-phase" inside the
 * context length L iff the wavelength 2π / θ_i ≤ L, i.e. the rotation
 * completes at least one full cycle within L. Subspaces to the right of the
 * band (lowest frequencies) never see a full rotation during training and are
 * the ones that go out-of-distribution at inference-time extrapolation.
 *
 * Cranking b from 10000 to 1,000,000 shifts all thetas down and pushes more
 * subspaces out of the usable band — which is the whole geometric story for
 * why NTK-aware scaling buys extrapolation at the cost of in-range fidelity.
 */
export const posencBaseScaling: ComputeFn = (params): ComputeResult => {
  const dim = Math.max(4, Math.round(asNumber(params, 'dim', 128)))
  const base = Math.max(10, asNumber(params, 'base', 10000))
  const ctx = Math.max(128, asNumber(params, 'ctx', 8192))

  const d = dim % 2 === 0 ? dim : dim - 1
  const half = d / 2

  const points: Point[] = []
  // Threshold subspace: largest i whose wavelength fits inside ctx.
  //   2π / θ_i ≤ ctx  ⇔  θ_i ≥ 2π / ctx
  // θ_i = b^(-2i/d) ⇒  i ≤ (d/2) · log(ctx / (2π)) / log(b)
  const iUsable = (d / 2) * (Math.log(Math.max(1, ctx / (2 * Math.PI))) / Math.log(base))
  const iUsableClamped = Math.max(0, Math.min(half, iUsable))

  for (let i = 0; i < half; i++) {
    const theta = Math.pow(base, (-2 * i) / d)
    const logTheta = Math.log10(theta)
    points.push({ x: i, y: logTheta, series: 'log10 θ_i' })
  }

  return {
    points,
    seriesKeys: ['log10 θ_i'],
    xDomain: [0, half - 1],
    annotations: [
      {
        type: 'band',
        from: 0,
        to: iUsableClamped,
        axis: 'x',
        label: `usable in ctx = ${ctx.toFixed(0)}`,
      },
      {
        type: 'vline',
        x: iUsableClamped,
        label: `cutoff ≈ ${iUsableClamped.toFixed(1)} / ${half}`,
      },
      {
        type: 'hline',
        y: Math.log10((2 * Math.PI) / ctx),
        label: `log10(2π / ctx)`,
      },
    ],
    summary: [
      { label: 'Head dim', value: String(d) },
      { label: 'Base b', value: base.toFixed(0) },
      { label: 'Context length', value: ctx.toFixed(0) },
      { label: 'Subspaces in-phase', value: `${iUsableClamped.toFixed(1)} / ${half}` },
      { label: 'Lowest freq θ', value: Math.pow(base, (-2 * (half - 1)) / d).toExponential(2) },
    ],
  }
}

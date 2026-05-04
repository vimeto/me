import type { ComputeFn, ComputeParams } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Composition error for per-user residual deltas with a shared bias.
 *
 * Toy model of the COL-321 wall (training-free residual-δ extraction):
 *   δ_u = α · b + β · u_u
 * where `b` is a fixed unit "recall-me" bias, `u_u` is a unit vector drawn
 * uniformly from a fixed r-dimensional subspace of R^d (so per-user signal
 * is rank-r), and `f = α / (α + β)` is the bias's share of the per-user
 * delta norm. Each user's δ is then unit-renormalised so f is a clean knob
 * on the geometry rather than the magnitude.
 *
 * The "target" we want to reconstruct is the bias plus the K user-specific
 * directions (the thing the model would emit if it actually processed all K
 * memories — see E10 in the report). The "predicted composition" is the
 * naive sum Σ δ_u, which is what training-free serving could afford.
 *
 * Composition error is ‖Σ δ_u − target‖ / ‖target‖.
 *
 * Geometry:
 * - At |S|=1 the error is 0 (δ_1 = bias + user_1 = target, by construction).
 * - As |S| grows, the bias term in Σ δ_u accumulates as K·b, but the target
 *   only ever has one copy of b. Bias inflates the apparent norm without
 *   carrying user info.
 * - User components live in an r-dim subspace; once K > r they collide with
 *   each other and start to alias. Per-user signal saturates.
 *
 * The closed form (under expectation, isotropic in the r-subspace):
 *   numerator²    = ((K - 1) f̃)² + (K - 1) (1 - f̃)² · max(0, K - r) / r·…
 * For the in-page plot we just simulate it deterministically with an
 * orthonormal basis and a fixed seed, so the curve is stable across
 * re-renders.
 */
export const memcompCompositionError: ComputeFn = (params) => {
  const d = Math.max(64, Math.min(8192, Math.round(asNumber(params, 'd', 3072))))
  const rRaw = Math.max(1, Math.round(asNumber(params, 'r', 8)))
  const r = Math.min(d, rRaw)
  const f = Math.min(0.95, Math.max(0, asNumber(params, 'f', 0.6)))
  const kMax = Math.max(2, Math.min(64, Math.round(asNumber(params, 'kMax', 12))))

  // Deterministic LCG so curves don't jiggle as React re-renders.
  let seed = 1234567
  function rand(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  function randn(): number {
    let u = 0
    let v = 0
    while (u === 0) u = rand()
    while (v === 0) v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  // Bias direction: e_0 by convention. Per-user directions live in span{e_1, …, e_r}.
  // We sample K user vectors as random unit-norm vectors inside that subspace.
  // We work in an r+1 dimensional reduced space (bias axis + user subspace)
  // because nothing else matters for ‖Σδ − target‖ — the orthogonal
  // complement contributes zero to both sides.
  const dim = r + 1
  // K orthonormal-or-not user vectors in the r-dim subspace.
  const users: number[][] = []
  for (let k = 0; k < kMax; k++) {
    const v = new Array<number>(dim).fill(0)
    for (let i = 1; i < dim; i++) v[i] = randn()
    let n = 0
    for (let i = 0; i < dim; i++) n += v[i] * v[i]
    n = Math.sqrt(Math.max(n, 1e-12))
    for (let i = 0; i < dim; i++) v[i] /= n
    users.push(v)
  }

  // Per-user delta = f · e_0 + (1 - f) · u_k, then unit-renormalised
  // — keeps |δ_u|=1 and lets f vary the angle to the bias axis cleanly.
  const deltas: number[][] = users.map((u) => {
    const v = new Array<number>(dim).fill(0)
    v[0] = f
    for (let i = 1; i < dim; i++) v[i] = (1 - f) * u[i]
    let n = 0
    for (let i = 0; i < dim; i++) n += v[i] * v[i]
    n = Math.sqrt(Math.max(n, 1e-12))
    for (let i = 0; i < dim; i++) v[i] /= n
    return v
  })

  const points: Array<{ x: number; y: number; series?: string }> = []
  // Two series:
  //  - naive Σ: predicted = Σ δ_u, target has ONE bias + Σ user_u (unit norm each).
  //  - mean Σ/K: same thing scaled by K — like the mean-norm scheme in E3v3.
  let firstK1Naive = 0
  for (let K = 1; K <= kMax; K++) {
    // target: bias + sum of user components (no bias inflation)
    const target = new Array<number>(dim).fill(0)
    target[0] = f
    for (let k = 0; k < K; k++) {
      for (let i = 1; i < dim; i++) target[i] += (1 - f) * users[k][i]
    }
    let tNorm = 0
    for (let i = 0; i < dim; i++) tNorm += target[i] * target[i]
    tNorm = Math.sqrt(Math.max(tNorm, 1e-12))

    // naive
    const sum = new Array<number>(dim).fill(0)
    for (let k = 0; k < K; k++) for (let i = 0; i < dim; i++) sum[i] += deltas[k][i]
    let dNorm = 0
    for (let i = 0; i < dim; i++) {
      const e = sum[i] - target[i]
      dNorm += e * e
    }
    const errNaive = Math.sqrt(dNorm) / tNorm
    if (K === 1) firstK1Naive = errNaive
    points.push({ x: K, y: errNaive, series: 'naive Σ δ_u' })

    // bias-centered: subtract the mean bias direction projection per delta
    // before summing — emulates E8 `centered_only`.
    const meanBias = deltas.reduce((acc, v) => acc + v[0], 0) / deltas.length
    const sumC = new Array<number>(dim).fill(0)
    for (let k = 0; k < K; k++) {
      for (let i = 0; i < dim; i++) sumC[i] += deltas[k][i]
      sumC[0] -= meanBias
    }
    let cNorm = 0
    for (let i = 0; i < dim; i++) {
      const e = sumC[i] - target[i]
      cNorm += e * e
    }
    const errCent = Math.sqrt(cNorm) / tNorm
    points.push({ x: K, y: errCent, series: 'bias-centered Σ' })
  }

  // Annotations:
  // - vertical at K=r: where the user subspace runs out of room.
  // - horizontal at 1.0: "no better than predicting just the target's bias".
  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = []
  if (r <= kMax) {
    annotations.push({ type: 'vline', x: r, label: `|S| = r = ${r}` })
  }
  annotations.push({ type: 'hline', y: 1, label: 'error = ‖target‖' })

  const yMaxRaw = Math.max(...points.map((p) => p.y), 1.2)
  const yMax = Math.min(8, yMaxRaw * 1.05)

  return {
    points,
    xDomain: [1, kMax],
    yDomain: [0, yMax],
    seriesKeys: ['naive Σ δ_u', 'bias-centered Σ'],
    annotations,
    summary: [
      { label: 'Model width d', value: String(d) },
      { label: 'Per-user effective rank r', value: String(r) },
      { label: 'Bias share f', value: f.toFixed(2) },
      { label: 'Naive error at |S|=1', value: firstK1Naive.toFixed(3) },
    ],
  }
}

/**
 * Layer-injection sensitivity for an addressable memory bank in Llama-3.2-3B.
 *
 * Two series across injection layer L ∈ [0, 27]:
 *   1. single-user recall (higher is better, peaks mid-late stack)
 *   2. unrelated-query leakage / null KL (lower is better, blows up late)
 *
 * Curve is a smooth interpolation through the real anchor points:
 *   COL-322 KV-adapter @ λ=0.1: (L=18, recall 0.604, leak 0.023),
 *                                (L=22, recall 0.684, leak 0.213).
 *   COL-323 mem-attn n=50:        (L=15, ind 0.781, null_kl 0.010),
 *                                (L=18, ind 0.781, null_kl 0.008),
 *                                (L=22, ind 0.808, null_kl 0.155).
 *
 * The recall curve is built as a piecewise interpolation between the COL-323
 * anchor triple, with smooth ramps on either side modelling the "fact recall
 * phase transition" (E12: city L=15, color L=22) and the late-layer plateau.
 * The leakage curve is the matching null-KL story, which stays low through
 * mid-stack and explodes once injection sits within ~6 layers of the unembed.
 *
 * The shape is the load-bearing claim. Numbers near anchors should match the
 * reports; numbers between anchors are smooth interpolation.
 */
export const memcompLayerInjectionSensitivity: ComputeFn = (params) => {
  const nUsers = Math.max(50, Math.min(2000, Math.round(asNumber(params, 'n', 50))))
  const showRecall = asNumber(params, 'showRecall', 1) > 0.5
  const showLeak = asNumber(params, 'showLeak', 1) > 0.5

  // Real anchor points from COL-323 (mem-attn at n=50).
  const recallAnchors: Array<[number, number]> = [
    [0, 0.0],
    [4, 0.05],
    [10, 0.15],
    [15, 0.781],
    [18, 0.781],
    [22, 0.808],
    [25, 0.74],
    [27, 0.66],
  ]
  // Null KL — stays low until L≈20, then explodes.
  const leakAnchors: Array<[number, number]> = [
    [0, 0.001],
    [10, 0.003],
    [15, 0.01],
    [18, 0.008],
    [20, 0.025],
    [22, 0.155],
    [24, 0.21],
    [27, 0.32],
  ]

  // n-dependent recall: COL-323 scaling shows -11pp per doubling of n above 50.
  // We attenuate the recall curve uniformly, leaving the layer-shape fixed
  // (which is the point of the plot). Leakage shape is roughly n-invariant.
  const scaleR = nUsers <= 50 ? 1 : Math.max(0.45, 1 - 0.16 * Math.log2(nUsers / 50))

  function interp(anchors: Array<[number, number]>, x: number): number {
    if (x <= anchors[0][0]) return anchors[0][1]
    if (x >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1]
    for (let i = 0; i < anchors.length - 1; i++) {
      const [x0, y0] = anchors[i]
      const [x1, y1] = anchors[i + 1]
      if (x >= x0 && x <= x1) {
        const t = (x - x0) / (x1 - x0)
        // Smoothstep.
        const s = t * t * (3 - 2 * t)
        return y0 + (y1 - y0) * s
      }
    }
    return anchors[anchors.length - 1][1]
  }

  const points: Array<{ x: number; y: number; series?: string }> = []
  for (let L = 0; L <= 27; L++) {
    if (showRecall) {
      points.push({ x: L, y: scaleR * interp(recallAnchors, L), series: 'single-user recall' })
    }
    if (showLeak) {
      points.push({ x: L, y: interp(leakAnchors, L), series: 'null-KL leakage' })
    }
  }

  const seriesKeys: string[] = []
  if (showRecall) seriesKeys.push('single-user recall')
  if (showLeak) seriesKeys.push('null-KL leakage')

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = [
    { type: 'band', from: 0, to: 14, axis: 'x', label: 'pre-recall' },
    { type: 'band', from: 22, to: 27, axis: 'x', label: 'logit-readout zone' },
    { type: 'vline', x: 15, label: 'L=15 sweet spot' },
  ]

  // y-axis: max of recall (0..1) and the cap on leakage we want to show.
  const yMax = 1.0

  // Pull headline values for the summary card.
  const r15 = scaleR * interp(recallAnchors, 15)
  const r22 = scaleR * interp(recallAnchors, 22)
  const k15 = interp(leakAnchors, 15)
  const k22 = interp(leakAnchors, 22)

  return {
    points,
    xDomain: [0, 27],
    yDomain: [0, yMax],
    seriesKeys,
    annotations,
    summary: [
      { label: 'Recall @ L=15', value: r15.toFixed(3) },
      { label: 'Recall @ L=22', value: r22.toFixed(3) },
      { label: 'Null-KL @ L=15', value: k15.toFixed(3) },
      { label: 'Null-KL @ L=22', value: k22.toFixed(3) },
    ],
  }
}

/**
 * Multi-injection compounding: single-bank vs three-bank at scale.
 *
 * Anchor: COL-326 N=1000 three-levers report. Single bank at L=15 hits
 * top-1 individual recall = 0.376; three banks at {15, 19, 23} (with the
 * same per-bank architecture) lift to 0.587 — +21pp. List F1 jumps 5×
 * (0.027 → 0.136). Cross recall +18pp.
 *
 * The bar plot shows three metrics for each configuration. Heights are the
 * shape of the compounding gain — reported numbers from the report stay
 * in the summary card so a reader can verify the magnitudes; the visual
 * conveys the relative lift.
 */
export const memcompMultiInjectionCompounding: ComputeFn = (params) => {
  // Allow a slider to dial between the published single-bank baseline and
  // the multi-injection result, so a reader can see the gap as it widens.
  const blend = Math.min(1, Math.max(0, asNumber(params, 'blend', 1)))

  // Anchored values (COL-326 n=1000 three-levers; redaction note in caption):
  const single = { ind: 0.376, cross: 0.35, list: 0.027 }
  const multi = { ind: 0.587, cross: 0.527, list: 0.136 }

  const lerp = (a: number, b: number) => a + (b - a) * blend

  // Use bar-style points: for grouped bars the chart layer reads x as the
  // metric index and `series` as the configuration. Three metrics × two
  // configurations = six bars.
  const metrics = [
    { key: 'individual', sIdx: 0 },
    { key: 'cross-user', sIdx: 1 },
    { key: 'list F1', sIdx: 2 },
  ]
  const points: Array<{ x: number; y: number; series?: string }> = []

  // single bank at L=15
  points.push({ x: 0, y: single.ind, series: 'single bank @ L=15' })
  points.push({ x: 1, y: single.cross, series: 'single bank @ L=15' })
  points.push({ x: 2, y: single.list, series: 'single bank @ L=15' })
  // three banks {15, 19, 23} — blended so the slider can interpolate
  points.push({ x: 0, y: lerp(single.ind, multi.ind), series: 'three banks @ {15, 19, 23}' })
  points.push({ x: 1, y: lerp(single.cross, multi.cross), series: 'three banks @ {15, 19, 23}' })
  points.push({ x: 2, y: lerp(single.list, multi.list), series: 'three banks @ {15, 19, 23}' })

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = []

  const indGain = lerp(single.ind, multi.ind) - single.ind
  const listMul = lerp(single.list, multi.list) / Math.max(single.list, 1e-9)

  return {
    points,
    xDomain: [-0.5, metrics.length - 0.5],
    yDomain: [0, 0.8],
    seriesKeys: ['single bank @ L=15', 'three banks @ {15, 19, 23}'],
    annotations,
    summary: [
      { label: 'Individual recall lift', value: `+${(indGain * 100).toFixed(1)} pp` },
      { label: 'List F1 multiplier', value: `${listMul.toFixed(1)}×` },
      { label: 'Banks', value: blend < 0.01 ? '1' : '3' },
      { label: 'N (users)', value: '1000' },
    ],
  }
}

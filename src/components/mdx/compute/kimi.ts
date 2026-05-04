import type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// bf16 bytes per scalar.
const BYTES_PER_ELEM = 2

/**
 * kimi.kvCacheVsContext
 *
 * KV-cache bytes vs context length for four attention variants:
 *   - MHA       : full multi-head, 2·h·d·L·T bytes at bf16
 *   - GQA       : h/group query heads share KV, so cache ÷ group
 *   - MLA       : DeepSeek-style, only the compressed latent of rank d_c
 *                 (plus a small decoupled-RoPE channel) is cached
 *   - KDA hybr. : a (ratio:1) hybrid of KDA and MLA layers. KDA layers carry
 *                 a context-independent recurrent state (O(h·d·d)); MLA
 *                 layers scale linearly in T on the remaining 1/(1+ratio)
 *                 fraction of the stack.
 *
 * The hybrid curve is the shallow one: a constant state offset plus a
 * scaled-down MLA line. A VRAM budget band sits at the top so the reader
 * can see where each variant runs out of room.
 */
export const kimiKvCacheVsContext: ComputeFn = (params): ComputeResult => {
  const heads = Math.max(1, Math.round(asNumber(params, 'heads', 32)))
  const headDim = Math.max(8, Math.round(asNumber(params, 'headDim', 128)))
  const layers = Math.max(4, Math.round(asNumber(params, 'layers', 48)))
  const gqaGroup = Math.max(1, Math.round(asNumber(params, 'gqaGroup', 8)))
  const dCompress = Math.max(16, Math.round(asNumber(params, 'dCompress', 512)))
  const ratio = Math.max(0, asNumber(params, 'ratio', 3))
  const maxContext = Math.max(4096, Math.round(asNumber(params, 'maxContext', 1_000_000)))
  const vramGB = Math.max(1, asNumber(params, 'vramGB', 80))

  // MLA decoupled RoPE channel width (per head) — DeepSeek-V2 uses 64.
  const ropeDim = 64
  // Heads used for the small decoupled RoPE key in MLA.
  const mlaRopeHeads = 1

  // Fraction of layers that are MLA in the hybrid: 1 MLA per ratio KDA layers.
  const mlaFrac = 1 / (1 + ratio)
  const kdaFrac = 1 - mlaFrac

  // KDA recurrent state per layer. A delta-rule linear-attention layer carries
  // a matrix S of shape (d_k × d_v) per head; with d_k = d_v = headDim, this is
  // h · headDim^2 elements. Constant in context length.
  const kdaStateBytes = BYTES_PER_ELEM * heads * headDim * headDim

  const samples = 121
  const points: Point[] = []
  let mhaAtMax = 0
  let gqaAtMax = 0
  let mlaAtMax = 0
  let hybridAtMax = 0
  const logMin = Math.log(1024)
  const logMax = Math.log(maxContext)
  for (let i = 0; i < samples; i++) {
    const t = logMin + ((logMax - logMin) * i) / (samples - 1)
    const context = Math.round(Math.exp(t))

    const mha = 2 * heads * headDim * layers * context * BYTES_PER_ELEM
    const gqa = 2 * (heads / gqaGroup) * headDim * layers * context * BYTES_PER_ELEM
    // MLA: cache the latent (rank d_c) + a small decoupled RoPE key per layer.
    const mlaPerLayer =
      BYTES_PER_ELEM * dCompress * context + BYTES_PER_ELEM * mlaRopeHeads * ropeDim * context
    const mla = mlaPerLayer * layers

    // Hybrid: kdaFrac of layers pay only the state cost; mlaFrac pay MLA cost.
    const hybridKdaBytes = kdaStateBytes * layers * kdaFrac
    const hybridMlaBytes = mlaPerLayer * layers * mlaFrac
    const hybrid = hybridKdaBytes + hybridMlaBytes

    points.push({ x: context, y: mha / 1e9, series: 'MHA' })
    points.push({ x: context, y: gqa / 1e9, series: 'GQA' })
    points.push({ x: context, y: mla / 1e9, series: 'MLA' })
    points.push({ x: context, y: hybrid / 1e9, series: 'KDA+MLA hybrid' })

    if (i === samples - 1) {
      mhaAtMax = mha
      gqaAtMax = gqa
      mlaAtMax = mla
      hybridAtMax = hybrid
    }
  }

  const mlaVsHybrid = hybridAtMax > 0 ? mlaAtMax / hybridAtMax : 0
  const cacheReduction = mlaAtMax > 0 ? (1 - hybridAtMax / mlaAtMax) * 100 : 0

  return {
    points,
    seriesKeys: ['MHA', 'GQA', 'MLA', 'KDA+MLA hybrid'],
    xDomain: [1024, maxContext],
    annotations: [{ type: 'hline', y: vramGB, label: `VRAM budget ≈ ${vramGB.toFixed(0)} GB` }],
    summary: [
      {
        label: `MHA @ ${maxContext.toLocaleString()} tok`,
        value: `${(mhaAtMax / 1e9).toFixed(1)} GB`,
      },
      { label: `GQA @ max`, value: `${(gqaAtMax / 1e9).toFixed(1)} GB` },
      { label: `MLA @ max`, value: `${(mlaAtMax / 1e9).toFixed(2)} GB` },
      { label: `Hybrid @ max`, value: `${(hybridAtMax / 1e9).toFixed(2)} GB` },
      {
        label: 'Hybrid vs MLA',
        value: `${mlaVsHybrid.toFixed(2)}× smaller (${cacheReduction.toFixed(0)}% cut)`,
      },
    ],
  }
}

/**
 * kimi.decodeRoofline
 *
 * Memory-bandwidth-bounded decode throughput vs context length. At decode
 * time each new token costs one full sweep over the KV cache plus the
 * weights. For long contexts the KV-cache read dominates, so
 *
 *   tokens/sec ≈ HBM_bandwidth / (KV_bytes_at_context + weight_bytes)
 *
 * We roll in a batch multiplier (more batch = more work done per HBM sweep,
 * because weight reads amortise — KV reads do not). Four curves, one per
 * attention variant, overlaid.
 */
export const kimiDecodeRoofline: ComputeFn = (params): ComputeResult => {
  const heads = Math.max(1, Math.round(asNumber(params, 'heads', 32)))
  const headDim = Math.max(8, Math.round(asNumber(params, 'headDim', 128)))
  const layers = Math.max(4, Math.round(asNumber(params, 'layers', 48)))
  const gqaGroup = Math.max(1, Math.round(asNumber(params, 'gqaGroup', 8)))
  const dCompress = Math.max(16, Math.round(asNumber(params, 'dCompress', 512)))
  const ratio = Math.max(0, asNumber(params, 'ratio', 3))
  const hbmGBs = Math.max(100, asNumber(params, 'hbmGBs', 3000))
  const batch = Math.max(1, Math.round(asNumber(params, 'batch', 1)))
  const weightGB = Math.max(0.1, asNumber(params, 'weightGB', 48))
  const maxContext = Math.max(4096, Math.round(asNumber(params, 'maxContext', 1_000_000)))

  const ropeDim = 64
  const mlaRopeHeads = 1
  const mlaFrac = 1 / (1 + ratio)
  const kdaFrac = 1 - mlaFrac
  const kdaStateBytes = BYTES_PER_ELEM * heads * headDim * headDim

  const hbmBytesPerSec = hbmGBs * 1e9
  const weightBytes = weightGB * 1e9

  const samples = 121
  const points: Point[] = []
  const logMin = Math.log(1024)
  const logMax = Math.log(maxContext)

  let mhaAtMax = 0
  let hybridAtMax = 0

  for (let i = 0; i < samples; i++) {
    const t = logMin + ((logMax - logMin) * i) / (samples - 1)
    const context = Math.round(Math.exp(t))

    const mhaCache = 2 * heads * headDim * layers * context * BYTES_PER_ELEM
    const gqaCache = 2 * (heads / gqaGroup) * headDim * layers * context * BYTES_PER_ELEM
    const mlaCachePerLayer =
      BYTES_PER_ELEM * dCompress * context + BYTES_PER_ELEM * mlaRopeHeads * ropeDim * context
    const mlaCache = mlaCachePerLayer * layers
    const hybridCache = kdaStateBytes * layers * kdaFrac + mlaCachePerLayer * layers * mlaFrac

    // Per-step bytes moved over HBM. KV cache is batch-independent (it's
    // per-sequence; batch reads B separate caches in parallel but bandwidth
    // is shared). Weights are amortised across the batch.
    const perStep = (cache: number) => cache * batch + weightBytes

    const mhaTps = hbmBytesPerSec / perStep(mhaCache)
    const gqaTps = hbmBytesPerSec / perStep(gqaCache)
    const mlaTps = hbmBytesPerSec / perStep(mlaCache)
    const hybridTps = hbmBytesPerSec / perStep(hybridCache)

    points.push({ x: context, y: mhaTps, series: 'MHA' })
    points.push({ x: context, y: gqaTps, series: 'GQA' })
    points.push({ x: context, y: mlaTps, series: 'MLA' })
    points.push({ x: context, y: hybridTps, series: 'KDA+MLA hybrid' })

    if (i === samples - 1) {
      mhaAtMax = mhaTps
      hybridAtMax = hybridTps
    }
  }

  const speedup = mhaAtMax > 0 ? hybridAtMax / mhaAtMax : 0

  return {
    points,
    seriesKeys: ['MHA', 'GQA', 'MLA', 'KDA+MLA hybrid'],
    xDomain: [1024, maxContext],
    summary: [
      { label: 'HBM bandwidth', value: `${hbmGBs.toFixed(0)} GB/s` },
      { label: 'Batch', value: String(batch) },
      { label: `MHA @ ${maxContext.toLocaleString()}`, value: `${mhaAtMax.toFixed(1)} tok/s` },
      {
        label: `Hybrid @ ${maxContext.toLocaleString()}`,
        value: `${hybridAtMax.toFixed(1)} tok/s`,
      },
      { label: 'Hybrid vs MHA', value: `${speedup.toFixed(2)}×` },
    ],
  }
}

/**
 * kimi.kdaRecurrence
 *
 * Delta-rule state dynamics, scalar toy. We track ‖S_t‖ over ~100 steps
 * under two gating regimes:
 *   - Gated DeltaNet: scalar forget gate α_t (same α applied to whole state)
 *   - KDA           : per-channel gate α_t[c] (diagonal), so some channels
 *                     decay slowly while others clear fast
 *
 * Update (a toy reduction of the gated delta rule):
 *   S_t = α_t ⊙ (S_{t-1} − β · (S_{t-1} · k_t − v_t) · k_t^T)
 *
 * We compute ‖S_t‖ and a "retention half-life" — the number of steps it
 * takes the state norm to halve once inputs are turned off. Per-channel
 * gating preserves useful slow channels while still draining fast ones;
 * a single scalar gate has to pick a compromise.
 */
export const kimiKdaRecurrence: ComputeFn = (params): ComputeResult => {
  const channels = 32
  const steps = Math.max(20, Math.round(asNumber(params, 'steps', 120)))
  const gateStrength = Math.min(0.999, Math.max(0.5, asNumber(params, 'gateStrength', 0.95)))
  const beta = Math.min(1, Math.max(0.05, asNumber(params, 'beta', 0.6)))
  const sparsity = Math.min(0.95, Math.max(0, asNumber(params, 'sparsity', 0.4)))
  const seed = Math.round(asNumber(params, 'seed', 11))

  // Deterministic PRNG.
  let s = (seed * 2654435761) >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
  const gauss = () => {
    const u = Math.max(1e-9, rnd())
    const v = rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  // Per-channel gates: some channels hold (near 1.0), others drain fast
  // (well below gateStrength). The geometric mean matches gateStrength so
  // the two schemes are "equal in forget-rate on average"; the difference
  // is that KDA gets to allocate retention selectively.
  const perChannelGate: number[] = []
  const gapLog = (1 - gateStrength) * 2.2 // width of the spread in logit-ish space
  for (let c = 0; c < channels; c++) {
    const tilt = c / (channels - 1) // 0..1, low = slow (kept), high = fast (drained)
    // Log-space interpolation around gateStrength: low channels closer to 1,
    // high channels noticeably below. Geo-mean stays near gateStrength.
    const logG = Math.log(gateStrength) + gapLog * (0.5 - tilt)
    const g = Math.exp(Math.min(logG, Math.log(0.999)))
    perChannelGate.push(Math.min(0.999, Math.max(0.5, g)))
  }
  const scalarGate = gateStrength

  // Toy: state is a length-C vector (one diagonal of the outer-product matrix).
  const stateKDA = new Array<number>(channels).fill(0)
  const stateGated = new Array<number>(channels).fill(0)
  const inputOffAt = Math.floor(steps * 0.6)
  const keptCutoff = Math.floor(channels / 2)

  const normKDA: number[] = []
  const normKDAkept: number[] = []
  const normGated: number[] = []

  for (let t = 0; t < steps; t++) {
    const inputsOn = t < inputOffAt
    for (let c = 0; c < channels; c++) {
      // Input keys/values — sparse Bernoulli mask * gaussian.
      const active = inputsOn && rnd() > sparsity ? 1 : 0
      const k = active ? gauss() : 0
      const v = active ? gauss() : 0
      // Reduced delta rule: error = s * k^2 - v * k; update = beta * error.
      const errKDA = stateKDA[c] * k * k - v * k
      const errGated = stateGated[c] * k * k - v * k
      stateKDA[c] = perChannelGate[c] * (stateKDA[c] - beta * errKDA)
      stateGated[c] = scalarGate * (stateGated[c] - beta * errGated)
    }
    let nK = 0
    let nKkept = 0
    let nG = 0
    for (let c = 0; c < channels; c++) {
      nK += stateKDA[c] * stateKDA[c]
      if (c < keptCutoff) nKkept += stateKDA[c] * stateKDA[c]
      nG += stateGated[c] * stateGated[c]
    }
    normKDA.push(Math.sqrt(nK))
    normKDAkept.push(Math.sqrt(nKkept))
    normGated.push(Math.sqrt(nG))
  }

  // Retention half-life: after inputs turn off, how long until norm halves.
  const halfLife = (trace: number[]): number => {
    const start = trace[inputOffAt] ?? 0
    if (start <= 1e-9) return NaN
    for (let t = inputOffAt; t < trace.length; t++) {
      if (trace[t] <= start * 0.5) return t - inputOffAt
    }
    return trace.length - inputOffAt
  }
  const hlKDA = halfLife(normKDAkept)
  const hlGated = halfLife(normGated)

  const points: Point[] = []
  for (let t = 0; t < steps; t++) {
    points.push({ x: t, y: normKDA[t], series: 'KDA (per-channel)' })
    points.push({ x: t, y: normGated[t], series: 'Gated DeltaNet (scalar)' })
  }

  return {
    points,
    seriesKeys: ['KDA (per-channel)', 'Gated DeltaNet (scalar)'],
    xDomain: [0, steps - 1],
    annotations: [{ type: 'vline', x: inputOffAt, label: 'inputs off' }],
    summary: [
      { label: 'Steps', value: String(steps) },
      { label: 'Scalar gate α', value: scalarGate.toFixed(3) },
      {
        label: 'Per-channel α range',
        value: `${perChannelGate[channels - 1].toFixed(2)}–${perChannelGate[0].toFixed(2)}`,
      },
      {
        label: 'Kept-channel half-life (KDA)',
        value: Number.isFinite(hlKDA) ? `${hlKDA} steps` : '>trace',
      },
      {
        label: 'Half-life (Gated, scalar)',
        value: Number.isFinite(hlGated) ? `${hlGated} steps` : '>trace',
      },
    ],
  }
}

/**
 * kimi.hybridRatio
 *
 * Recall-vs-throughput Pareto as the KDA:MLA ratio sweeps from 0 (pure MLA)
 * to ~15 (nearly pure KDA). We plot two normalised series against ratio:
 *   - throughput surrogate : decode tokens/sec at a fixed long context,
 *                            using the same roofline as kimi.decodeRoofline
 *   - recall surrogate     : 1 − retentionPenalty · mlaFrac^(-1)·… i.e. as the
 *                            MLA share falls, long-range recall eventually
 *                            drops off (toy sigmoid knee around ratio 3–4).
 *
 * The reader should find a knee near ratio ≈ 3, matching the paper.
 */
export const kimiHybridRatio: ComputeFn = (params): ComputeResult => {
  const heads = Math.max(1, Math.round(asNumber(params, 'heads', 32)))
  const headDim = Math.max(8, Math.round(asNumber(params, 'headDim', 128)))
  const layers = Math.max(4, Math.round(asNumber(params, 'layers', 48)))
  const dCompress = Math.max(16, Math.round(asNumber(params, 'dCompress', 512)))
  const context = Math.max(4096, Math.round(asNumber(params, 'context', 1_000_000)))
  const hbmGBs = Math.max(100, asNumber(params, 'hbmGBs', 3000))
  const weightGB = Math.max(0.1, asNumber(params, 'weightGB', 48))
  const recallPenalty = Math.max(0, Math.min(2, asNumber(params, 'recallPenalty', 0.35)))

  const ropeDim = 64
  const mlaRopeHeads = 1
  const kdaStateBytes = BYTES_PER_ELEM * heads * headDim * headDim
  const hbmBytesPerSec = hbmGBs * 1e9
  const weightBytes = weightGB * 1e9
  const mlaCachePerLayer =
    BYTES_PER_ELEM * dCompress * context + BYTES_PER_ELEM * mlaRopeHeads * ropeDim * context

  const ratios: number[] = []
  const samples = 121
  for (let i = 0; i < samples; i++) {
    // Log-spaced from 0 to 15, inclusive of 0.
    const r = (15 * i) / (samples - 1)
    ratios.push(r)
  }

  // Reference points: pure MLA (ratio = 0) and pure KDA (large ratio).
  const pureMlaThroughput = hbmBytesPerSec / (mlaCachePerLayer * layers + weightBytes)

  // Compute raw values, then normalise to [0, 1] for the Pareto view.
  const rawThroughput: number[] = []
  const rawRecall: number[] = []
  for (const r of ratios) {
    const mlaFrac = 1 / (1 + r)
    const kdaFrac = 1 - mlaFrac
    const cache = kdaStateBytes * layers * kdaFrac + mlaCachePerLayer * layers * mlaFrac
    const tps = hbmBytesPerSec / (cache + weightBytes)
    rawThroughput.push(tps)

    // Recall surrogate: starts at 1 for pure MLA; drops via a sigmoid as the
    // global-attention share shrinks. Knee controlled by recallPenalty.
    //   recall = sigmoid(4 * (mlaFrac - knee) / scale)
    // We tune the knee so at ratio = 3 (mlaFrac = 0.25) recall is ~0.9 when
    // recallPenalty is small, dropping sharply once the penalty bites.
    const knee = 0.08 + 0.12 * recallPenalty
    const scale = 0.18
    const x = (mlaFrac - knee) / scale
    const sigmoid = 1 / (1 + Math.exp(-4 * x))
    rawRecall.push(sigmoid)
  }

  const tpsMax = Math.max(...rawThroughput)
  const tpsMin = Math.min(...rawThroughput)

  const points: Point[] = []
  let kneeRatio = 0
  let kneeScore = -Infinity
  for (let i = 0; i < ratios.length; i++) {
    const r = ratios[i]
    const tpsNorm = (rawThroughput[i] - tpsMin) / Math.max(1e-9, tpsMax - tpsMin)
    const recallNorm = rawRecall[i]
    points.push({ x: r, y: tpsNorm, series: 'throughput (norm.)' })
    points.push({ x: r, y: recallNorm, series: 'recall (surrogate)' })
    // Geometric mean as a crude knee finder.
    const score = Math.sqrt(Math.max(0, tpsNorm) * Math.max(0, recallNorm))
    if (score > kneeScore) {
      kneeScore = score
      kneeRatio = r
    }
  }

  return {
    points,
    seriesKeys: ['throughput (norm.)', 'recall (surrogate)'],
    xDomain: [0, 15],
    yDomain: [0, 1.05],
    annotations: [
      { type: 'vline', x: 3, label: 'paper choice: 3:1' },
      { type: 'vline', x: kneeRatio, label: `surrogate knee ≈ ${kneeRatio.toFixed(1)}:1` },
    ],
    summary: [
      { label: 'Context', value: context.toLocaleString() },
      { label: 'Pure-MLA throughput', value: `${pureMlaThroughput.toFixed(1)} tok/s` },
      { label: 'Max throughput (≈ pure KDA)', value: `${tpsMax.toFixed(1)} tok/s` },
      { label: 'Paper ratio', value: '3:1 KDA:MLA' },
      { label: 'Surrogate knee', value: `${kneeRatio.toFixed(1)}:1` },
    ],
  }
}

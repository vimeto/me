import type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// Deterministic LCG so plots are stable across renders but params drive shape.
function seeded(seed: number): () => number {
  let s = (Math.floor(seed) * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

// Notional per-layer sensitivity. Transformers typically show big spikes at
// the early and late layers and at attention projections; MLP down-projections
// in the middle can be surprisingly well-behaved. We fake that shape with a
// deterministic mix of a U-shape plus per-layer jitter.
function layerSensitivity(
  layer: number,
  totalLayers: number,
  spread: number,
  seed: number
): number {
  const t = layer / Math.max(1, totalLayers - 1) // 0..1
  // U-shape: high at ends, lower in the middle.
  const u = 1.2 * Math.pow(2 * t - 1, 2) + 0.25
  // Periodic "attention spikes" every 4th layer.
  const spike = layer % 4 === 0 ? 0.45 : 0
  // Deterministic jitter.
  const rng = seeded(seed + layer * 17)
  const jitter = (rng() - 0.5) * 2 * spread
  return Math.max(0.05, u + spike + jitter)
}

/**
 * mixedPrec.layerSensitivity
 *
 * Notional per-layer sensitivity histogram. Each bar is the relative quant
 * sensitivity s_i of layer i, computed from a toy U-shape + jitter. Purpose:
 * show that layers are NOT interchangeable; there is a fat tail of hard layers.
 */
export const mixedPrecLayerSensitivity: ComputeFn = (params): ComputeResult => {
  const layers = Math.max(4, Math.min(96, Math.round(asNumber(params, 'layers', 32))))
  const spread = Math.max(0, asNumber(params, 'spread', 0.35))
  const seed = Math.round(asNumber(params, 'seed', 7))

  const points: Point[] = []
  let maxS = 0
  let sumS = 0
  for (let i = 0; i < layers; i++) {
    const s = layerSensitivity(i, layers, spread, seed)
    points.push({ x: i, y: s })
    if (s > maxS) maxS = s
    sumS += s
  }
  const meanS = sumS / layers

  // Mark the "hard tail" — layers whose sensitivity exceeds mean + 1.5× the
  // gap between max and mean. These are the ones you pay to keep in FP16.
  const hardThreshold = meanS + 0.6 * (maxS - meanS)
  const hardIdx: number[] = []
  for (const p of points) if (p.y >= hardThreshold) hardIdx.push(p.x)

  const annotations: NonNullable<ComputeResult['annotations']> = [
    { type: 'hline', y: meanS, label: `mean = ${meanS.toFixed(2)}` },
    { type: 'hline', y: hardThreshold, label: `hard tail ≥ ${hardThreshold.toFixed(2)}` },
  ]
  // Bands over contiguous hard-tail runs, so the eye catches them.
  let runStart: number | null = null
  for (let i = 0; i < layers; i++) {
    const isHard = points[i].y >= hardThreshold
    if (isHard && runStart === null) runStart = i
    if (!isHard && runStart !== null) {
      annotations.push({ type: 'band', from: runStart - 0.5, to: i - 0.5, axis: 'x' })
      runStart = null
    }
  }
  if (runStart !== null)
    annotations.push({ type: 'band', from: runStart - 0.5, to: layers - 0.5, axis: 'x' })

  return {
    points,
    xDomain: [-0.5, layers - 0.5],
    yDomain: [0, maxS * 1.1],
    annotations,
    summary: [
      { label: 'Layers', value: String(layers) },
      { label: 'Mean sensitivity', value: meanS.toFixed(3) },
      { label: 'Max sensitivity', value: maxS.toFixed(3) },
      { label: 'Hard-tail layers', value: `${hardIdx.length} / ${layers}` },
    ],
  }
}

/**
 * mixedPrec.bitAllocation
 *
 * Greedy water-filling. For each layer with sensitivity s_i, the toy quant
 * error is s_i * 2^(-2·b_i). We minimise total error subject to Σ b_i / N = B
 * (average bits/weight). The Lagrangian gives b_i* = ½·(log2(s_i) - log2(ν))
 * + const, i.e. the sensitive layers get more bits. We enforce hard bounds
 * [minBits, maxBits] and binary-search for the water level ν.
 *
 * Plot: bits assigned per layer (bar) vs. a uniform baseline (hline).
 */
export const mixedPrecBitAllocation: ComputeFn = (params): ComputeResult => {
  const layers = Math.max(4, Math.min(96, Math.round(asNumber(params, 'layers', 32))))
  const targetBits = Math.max(1.5, Math.min(8, asNumber(params, 'targetBits', 4)))
  const minBits = Math.max(1, Math.min(4, asNumber(params, 'minBits', 2)))
  const maxBits = Math.max(minBits + 0.25, Math.min(16, asNumber(params, 'maxBits', 8)))
  const spread = Math.max(0, asNumber(params, 'spread', 0.35))
  const seed = Math.round(asNumber(params, 'seed', 7))

  const s: number[] = []
  for (let i = 0; i < layers; i++) s.push(layerSensitivity(i, layers, spread, seed))

  // For a fixed water level ν, the unconstrained optimum is
  //   b_i = 0.5 * log2(s_i / ν)  (+ const absorbed into ν)
  // We clamp to [minBits, maxBits] and binary-search ν until mean(b) = target.
  function allocate(nu: number): number[] {
    const out: number[] = []
    for (let i = 0; i < layers; i++) {
      const raw = 0.5 * Math.log2(Math.max(1e-9, s[i] / Math.max(1e-9, nu)))
      out.push(Math.max(minBits, Math.min(maxBits, raw)))
    }
    return out
  }
  function meanBits(alloc: number[]): number {
    let t = 0
    for (const b of alloc) t += b
    return t / alloc.length
  }

  // Bracket ν. Large ν → few bits; small ν → many bits.
  let lo = 1e-6
  let hi = 1e6
  for (let iter = 0; iter < 80; iter++) {
    const mid = Math.sqrt(lo * hi)
    const m = meanBits(allocate(mid))
    if (m > targetBits) lo = mid
    else hi = mid
  }
  const bits = allocate(Math.sqrt(lo * hi))

  // Compute total error versus a uniform-bits baseline at the same avg.
  let errMixed = 0
  let errUniform = 0
  for (let i = 0; i < layers; i++) {
    errMixed += s[i] * Math.pow(2, -2 * bits[i])
    errUniform += s[i] * Math.pow(2, -2 * targetBits)
  }
  const improvement = errUniform > 0 ? (1 - errMixed / errUniform) * 100 : 0

  const points: Point[] = bits.map((b, i) => ({ x: i, y: b }))
  const maxPlot = Math.max(maxBits, targetBits + 1)

  return {
    points,
    xDomain: [-0.5, layers - 0.5],
    yDomain: [0, maxPlot],
    annotations: [
      { type: 'hline', y: targetBits, label: `uniform baseline = ${targetBits.toFixed(2)} bits` },
      { type: 'hline', y: minBits, label: `floor = ${minBits}` },
      { type: 'hline', y: maxBits, label: `ceiling = ${maxBits}` },
    ],
    summary: [
      { label: 'Avg bits (achieved)', value: meanBits(bits).toFixed(3) },
      { label: 'Uniform error', value: errUniform.toExponential(2) },
      { label: 'Mixed error', value: errMixed.toExponential(2) },
      { label: 'Error reduction', value: `${improvement.toFixed(1)}%` },
    ],
  }
}

/**
 * mixedPrec.pplFrontier
 *
 * Perplexity-vs-avg-bits Pareto curve. Uniform-bits ppl uses a synthetic
 * ppl(b) = ppl_fp16 * (1 + α · 2^(-β · b)). Mixed-precision ppl uses the
 * same model applied per-layer under the allocation above, averaged.
 * We also highlight where a plain "uniform 4-bit" sits vs. the optimal
 * mixed-precision frontier.
 */
export const mixedPrecPplFrontier: ComputeFn = (params): ComputeResult => {
  const pplFp16 = Math.max(1, asNumber(params, 'pplFp16', 5.6))
  const alpha = Math.max(0, asNumber(params, 'alpha', 4.5))
  const beta = Math.max(0.1, asNumber(params, 'beta', 1.3))
  const layers = Math.max(4, Math.min(96, Math.round(asNumber(params, 'layers', 32))))
  const spread = Math.max(0, asNumber(params, 'spread', 0.35))
  const seed = Math.round(asNumber(params, 'seed', 7))
  const highlightBits = Math.max(2, Math.min(8, asNumber(params, 'highlightBits', 4)))

  const s: number[] = []
  let sMean = 0
  for (let i = 0; i < layers; i++) {
    const v = layerSensitivity(i, layers, spread, seed)
    s.push(v)
    sMean += v
  }
  sMean /= layers

  // Uniform ppl(b) baseline — per-layer error scales with s_i/sMean so the
  // "average" layer matches the top-line formula.
  function uniformPpl(b: number): number {
    let err = 0
    for (const si of s) err += (si / sMean) * alpha * Math.pow(2, -beta * b)
    return pplFp16 * (1 + err / layers)
  }

  // Mixed-precision ppl at a target average, via the same water-filling.
  function mixedPpl(targetBits: number): number {
    // Inline allocate at target.
    function allocate(nu: number) {
      const out: number[] = []
      for (let i = 0; i < layers; i++) {
        const raw = 0.5 * Math.log2(Math.max(1e-9, s[i] / Math.max(1e-9, nu)))
        out.push(Math.max(2, Math.min(8, raw)))
      }
      return out
    }
    let lo = 1e-6
    let hi = 1e6
    for (let iter = 0; iter < 60; iter++) {
      const mid = Math.sqrt(lo * hi)
      const alloc = allocate(mid)
      let m = 0
      for (const b of alloc) m += b
      m /= alloc.length
      if (m > targetBits) lo = mid
      else hi = mid
    }
    const alloc = allocate(Math.sqrt(lo * hi))
    let err = 0
    for (let i = 0; i < layers; i++) err += (s[i] / sMean) * alpha * Math.pow(2, -beta * alloc[i])
    return pplFp16 * (1 + err / layers)
  }

  const samples = 181
  const xMin = 2
  const xMax = 8
  const points: Point[] = []
  for (let i = 0; i < samples; i++) {
    const b = xMin + ((xMax - xMin) * i) / (samples - 1)
    points.push({ x: b, y: uniformPpl(b), series: 'uniform' })
  }
  for (let i = 0; i < samples; i++) {
    const b = xMin + ((xMax - xMin) * i) / (samples - 1)
    points.push({ x: b, y: mixedPpl(b), series: 'mixed' })
  }

  const uniformHighlight = uniformPpl(highlightBits)
  const mixedHighlight = mixedPpl(highlightBits)
  const gap = uniformHighlight - mixedHighlight

  // y-domain: clip to something sensible so the curves are legible.
  const yMax = Math.min(uniformPpl(xMin), pplFp16 * 4)

  return {
    points,
    seriesKeys: ['uniform', 'mixed'],
    xDomain: [xMin, xMax],
    yDomain: [pplFp16 * 0.98, yMax],
    annotations: [
      { type: 'hline', y: pplFp16, label: `fp16 ppl = ${pplFp16.toFixed(2)}` },
      { type: 'vline', x: highlightBits, label: `${highlightBits.toFixed(2)}-bit avg` },
    ],
    summary: [
      { label: 'fp16 ppl', value: pplFp16.toFixed(2) },
      { label: `Uniform @ ${highlightBits.toFixed(2)}b`, value: uniformHighlight.toFixed(3) },
      { label: `Mixed @ ${highlightBits.toFixed(2)}b`, value: mixedHighlight.toFixed(3) },
      { label: 'Gap (ppl)', value: gap.toFixed(3) },
    ],
  }
}

/**
 * mixedPrec.hwLatency
 *
 * Toy hardware model. INT4 matmul is T_int4 per unit work; FP16 matmul is
 * T_fp16 > T_int4. A mixed-precision layer pays a conversion overhead
 * C per boundary between precisions. Total latency as a function of the
 * mixed-fraction f ∈ [0, 1] (fraction of layers kept in FP16) is
 *
 *   L(f) = (1 - f) * T_int4 + f * T_fp16 + crossings(f) * C
 *
 * where crossings(f) ≈ 2 * f * (1 - f) * N (expected number of boundaries
 * when FP16 layers are interleaved). There's a sweet spot where you spend
 * a few FP16 layers on the sensitive ones and pay acceptable conversion cost.
 */
export const mixedPrecHwLatency: ComputeFn = (params): ComputeResult => {
  const layers = Math.max(4, Math.min(128, Math.round(asNumber(params, 'layers', 32))))
  const tInt4 = Math.max(0.01, asNumber(params, 'tInt4', 0.8))
  const tFp16 = Math.max(tInt4, asNumber(params, 'tFp16', 2.1))
  const convCost = Math.max(0, asNumber(params, 'convCost', 0.35))

  const samples = 201
  const points: Point[] = []
  let bestInterX = 0
  let bestInterY = Infinity
  let bestClustX = 0
  let bestClustY = Infinity
  for (let i = 0; i < samples; i++) {
    const f = i / (samples - 1)
    const workPerLayer = (1 - f) * tInt4 + f * tFp16
    const baseWork = layers * workPerLayer
    // Interleaved: expected 2 f (1-f) N boundaries under random placement.
    const interLat = baseWork + 2 * f * (1 - f) * layers * convCost
    // Clustered: FP16 layers contiguous → at most 2 boundaries when 0 < f < 1.
    const clustLat = baseWork + (f > 0 && f < 1 ? 2 : 0) * convCost
    points.push({ x: f, y: interLat, series: 'interleaved' })
    points.push({ x: f, y: clustLat, series: 'clustered' })
    if (interLat < bestInterY) {
      bestInterY = interLat
      bestInterX = f
    }
    if (clustLat < bestClustY) {
      bestClustY = clustLat
      bestClustX = f
    }
  }

  const latencyAllInt4 = layers * tInt4
  const latencyAllFp16 = layers * tFp16

  return {
    points,
    seriesKeys: ['interleaved', 'clustered'],
    xDomain: [0, 1],
    yDomain: [0, Math.max(latencyAllFp16, bestInterY, bestClustY) * 1.05],
    annotations: [
      { type: 'hline', y: latencyAllInt4, label: `all-INT4 = ${latencyAllInt4.toFixed(1)}` },
      { type: 'hline', y: latencyAllFp16, label: `all-FP16 = ${latencyAllFp16.toFixed(1)}` },
    ],
    summary: [
      { label: 'All-INT4 latency', value: latencyAllInt4.toFixed(2) },
      { label: 'All-FP16 latency', value: latencyAllFp16.toFixed(2) },
      {
        label: 'Interleaved min',
        value: `${bestInterY.toFixed(2)} @ f=${(bestInterX * 100).toFixed(0)}%`,
      },
      {
        label: 'Clustered min',
        value: `${bestClustY.toFixed(2)} @ f=${(bestClustX * 100).toFixed(0)}%`,
      },
    ],
  }
}

import type { ComputeFn, ComputeParams } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * RMSNorm vs LayerNorm wall-clock cost, toy model.
 *
 * LayerNorm per token ≈ 6·d FLOPs (subtract mean, variance, normalise,
 * affine). RMSNorm drops the mean-subtraction pass: ≈ 4·d FLOPs. We roll in a
 * small fixed overhead to mimic kernel launch cost and plot total microseconds
 * vs. sequence length for a given hidden dim and per-FLOP throughput.
 *
 * Overlaid series so the reader can see the gap open with context.
 */
export const archRmsVsLayerNorm: ComputeFn = (params) => {
  const dim = Math.max(16, asNumber(params, 'dim', 4096))
  const maxSeq = Math.max(128, asNumber(params, 'maxSeq', 8192))
  const tflops = Math.max(0.1, asNumber(params, 'tflops', 200))
  const launchUs = Math.max(0, asNumber(params, 'launchUs', 3))

  const flopsPerSec = tflops * 1e12
  const samples = 161

  const points: Array<{ x: number; y: number; series?: string }> = []
  let lastLn = 0
  let lastRms = 0
  for (let i = 0; i < samples; i++) {
    const seq = Math.max(1, Math.round((maxSeq * i) / (samples - 1)))
    const lnFlops = 6 * dim * seq
    const rmsFlops = 4 * dim * seq
    const lnUs = launchUs + (lnFlops / flopsPerSec) * 1e6
    const rmsUs = launchUs + (rmsFlops / flopsPerSec) * 1e6
    points.push({ x: seq, y: lnUs, series: 'LayerNorm' })
    points.push({ x: seq, y: rmsUs, series: 'RMSNorm' })
    if (i === samples - 1) {
      lastLn = lnUs
      lastRms = rmsUs
    }
  }

  const savings = lastLn > 0 ? (1 - lastRms / lastLn) * 100 : 0

  return {
    points,
    seriesKeys: ['LayerNorm', 'RMSNorm'],
    xDomain: [0, maxSeq],
    annotations: [
      {
        type: 'vline',
        x: maxSeq,
        label: `@${maxSeq} tok: ${lastRms.toFixed(1)}µs vs ${lastLn.toFixed(1)}µs`,
      },
    ],
    summary: [
      { label: 'Hidden dim d', value: String(dim) },
      { label: 'LayerNorm FLOPs/token', value: `${6 * dim}` },
      { label: 'RMSNorm FLOPs/token', value: `${4 * dim}` },
      { label: 'Savings at max seq', value: `${savings.toFixed(1)}%` },
    ],
  }
}

/**
 * SwiGLU response surface (1D slice).
 *
 * y_swiglu(x) = swish(w1 · x) * (w2 · x), with swish(z) = z · sigmoid(z).
 * Overlaid with plain ReLU(w · x) for visual contrast. The multiplicative
 * gate lets the unit smoothly carve saddles that a pointwise nonlinearity
 * cannot — this is the empirical reason SwiGLU wins on loss-per-parameter.
 */
export const archSwiglu: ComputeFn = (params) => {
  const w1 = asNumber(params, 'w1', 1.2)
  const w2 = asNumber(params, 'w2', 0.8)
  const wRelu = asNumber(params, 'wRelu', 1.0)
  const range = Math.max(1, asNumber(params, 'range', 4))

  const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
  const swish = (z: number) => z * sigmoid(z)

  const samples = 241
  const points: Array<{ x: number; y: number; series?: string }> = []
  let peakSwiglu = 0
  let peakX = 0
  for (let i = 0; i < samples; i++) {
    const x = -range + (2 * range * i) / (samples - 1)
    const ySwiglu = swish(w1 * x) * (w2 * x)
    const yRelu = Math.max(0, wRelu * x)
    points.push({ x, y: ySwiglu, series: 'SwiGLU' })
    points.push({ x, y: yRelu, series: 'ReLU' })
    if (Math.abs(ySwiglu) > Math.abs(peakSwiglu)) {
      peakSwiglu = ySwiglu
      peakX = x
    }
  }

  return {
    points,
    seriesKeys: ['SwiGLU', 'ReLU'],
    xDomain: [-range, range],
    annotations: [
      { type: 'vline', x: 0, label: 'origin' },
      { type: 'vline', x: peakX, label: `SwiGLU peak ≈ ${peakSwiglu.toFixed(2)}` },
    ],
    summary: [
      { label: 'FFN param ratio', value: '1.5× plain FFN' },
      { label: 'Gate', value: 'swish(w1·x)·(w2·x)' },
      { label: 'Comparison', value: 'ReLU(w·x)' },
    ],
  }
}

/**
 * RoPE: average cosine similarity between q at position 0 and k at offset m,
 * assuming q = k. For head dim d with base b, each 2D subspace i ∈ [0, d/2)
 * rotates at θ_i = b^(-2i/d). The mean pairwise inner product (over the d/2
 * subspaces) of a query and key separated by m is
 *   s(m) = (2/d) Σ_i cos(m · θ_i).
 *
 * Plot s(m) vs. m. Low-frequency subspaces give long-range coherence; the
 * high-frequency ones drive the short-range fluctuations you see in the curve.
 */
export const archRopeSimilarity: ComputeFn = (params) => {
  const dim = Math.max(4, Math.round(asNumber(params, 'dim', 64)))
  const base = Math.max(10, asNumber(params, 'base', 10000))
  const maxOffset = Math.max(16, asNumber(params, 'maxOffset', 2048))

  const d = dim % 2 === 0 ? dim : dim - 1
  const half = d / 2
  const thetas: number[] = []
  for (let i = 0; i < half; i++) {
    thetas.push(Math.pow(base, (-2 * i) / d))
  }

  const samples = 321
  const points: Array<{ x: number; y: number }> = []
  let firstZero: number | null = null
  for (let i = 0; i < samples; i++) {
    const m = (maxOffset * i) / (samples - 1)
    let acc = 0
    for (let k = 0; k < half; k++) acc += Math.cos(m * thetas[k])
    const s = acc / half
    if (firstZero === null && i > 0 && s <= 0) firstZero = m
    points.push({ x: m, y: s })
  }

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = [{ type: 'hline', y: 0, label: 'zero coherence' }]
  if (firstZero !== null) {
    annotations.push({
      type: 'vline',
      x: firstZero,
      label: `first zero ≈ ${firstZero.toFixed(0)} tok`,
    })
  }

  return {
    points,
    xDomain: [0, maxOffset],
    yDomain: [-0.5, 1],
    annotations,
    summary: [
      { label: 'Head dim', value: String(d) },
      { label: 'Base', value: base.toFixed(0) },
      { label: 'Lowest freq θ', value: thetas[half - 1].toExponential(2) },
      { label: 'Highest freq θ', value: thetas[0].toExponential(2) },
    ],
  }
}

/**
 * Toy "quality per FLOP" of a modern Llama-style block vs. a vanilla GPT-2
 * block, swept over the per-swap advantage dial.
 *
 * Vanilla baseline: Q_v = 1, F_v = 1.
 * Modern block: each of (SwiGLU, RMSNorm, RoPE) contributes a user-set
 * quality lift and a FLOP delta. The summed Q_m / F_m ratio is what open
 * models actually win on — small in absolute terms, consistent across
 * scales.
 */
export const archBlockQualityPerFlop: ComputeFn = (params) => {
  const swigluLift = asNumber(params, 'swigluLift', 0.04)
  const rmsLift = asNumber(params, 'rmsLift', 0.005)
  const ropeLift = asNumber(params, 'ropeLift', 0.02)
  const maxScale = Math.max(0.5, asNumber(params, 'maxScale', 2))

  // Per-swap FLOP deltas as fraction of the baseline block FLOPs. SwiGLU at
  // matched parameter count (inner width shrunk by 2/3) is near-wash on
  // compute; we keep a small overhead for the extra matmul launch.
  const swigluCost = 0.03
  const rmsCost = -0.01
  const ropeCost = 0.005

  const samples = 161
  const points: Array<{ x: number; y: number; series?: string }> = []
  let lastRatio = 0
  for (let i = 0; i < samples; i++) {
    const s = (maxScale * i) / (samples - 1)
    const qModern = 1 + s * (swigluLift + rmsLift + ropeLift)
    const fModern = 1 + s * (swigluCost + rmsCost + ropeCost)
    const ratio = qModern / fModern
    points.push({ x: s, y: 1, series: 'vanilla GPT-2 block' })
    points.push({ x: s, y: ratio, series: 'Llama-style block' })
    if (i === samples - 1) lastRatio = ratio
  }

  const edge = (lastRatio - 1) * 100

  return {
    points,
    seriesKeys: ['vanilla GPT-2 block', 'Llama-style block'],
    xDomain: [0, maxScale],
    annotations: [
      { type: 'hline', y: 1, label: 'baseline' },
      {
        type: 'vline',
        x: maxScale,
        label: `edge @ full: ${edge >= 0 ? '+' : ''}${edge.toFixed(1)}%`,
      },
    ],
    summary: [
      {
        label: 'SwiGLU Δquality/ΔFLOPs',
        value: `+${(swigluLift * 100).toFixed(1)}% / +${(swigluCost * 100).toFixed(1)}%`,
      },
      {
        label: 'RMSNorm Δquality/ΔFLOPs',
        value: `+${(rmsLift * 100).toFixed(1)}% / ${(rmsCost * 100).toFixed(1)}%`,
      },
      {
        label: 'RoPE Δquality/ΔFLOPs',
        value: `+${(ropeLift * 100).toFixed(1)}% / +${(ropeCost * 100).toFixed(1)}%`,
      },
      { label: 'Composite Q/F edge', value: `${edge >= 0 ? '+' : ''}${edge.toFixed(1)}%` },
    ],
  }
}

/**
 * Pre-norm vs post-norm gradient propagation, toy model.
 *
 * Linearise each residual block as a scalar recursion. Pre-norm:
 *   x_{l+1} = x_l + α · norm(x_l), so the gradient through depth keeps a
 *   "1·" path that survives intact; ‖∇‖ stays close to 1 across L.
 * Post-norm:
 *   x_{l+1} = norm(x_l + α · f(x_l)). Each block applies a normalisation that
 *   contracts magnitude by roughly (1 + α²)^(-1/2). Iterated L times,
 *   ‖∇‖ ~ (1 + α²)^(-L/2): geometric decay in depth.
 *
 * Plot ‖∇‖ vs depth l ∈ [0, L] for both regimes; the post-norm curve falls
 * off cliff-like at large L, the pre-norm curve hovers near 1.
 */
export const archPreVsPostNorm: ComputeFn = (params) => {
  const depth = Math.max(2, Math.round(asNumber(params, 'depth', 48)))
  const residualScale = Math.max(0.01, asNumber(params, 'residualScale', 1))

  const samples = Math.max(depth + 1, 161)
  const points: Array<{ x: number; y: number; series?: string }> = []
  const contraction = 1 / Math.sqrt(1 + residualScale * residualScale)

  let lastPre = 1
  let lastPost = 1
  for (let i = 0; i < samples; i++) {
    const l = (depth * i) / (samples - 1)
    // Pre-norm: ‖∇‖ stays near 1, with a tiny logarithmic settle from the norm
    // jacobian; we model it as a gentle (1 + 0.05·α²·log(1+l)) drift.
    const pre = 1 / (1 + 0.05 * residualScale * residualScale * Math.log(1 + l))
    // Post-norm: geometric decay in l.
    const post = Math.pow(contraction, l)
    points.push({ x: l, y: pre, series: 'pre-norm' })
    points.push({ x: l, y: post, series: 'post-norm' })
    if (i === samples - 1) {
      lastPre = pre
      lastPost = post
    }
  }

  const ratio = lastPre > 0 ? lastPost / lastPre : 0

  return {
    points,
    seriesKeys: ['pre-norm', 'post-norm'],
    xDomain: [0, depth],
    yDomain: [0, 1.05],
    annotations: [
      { type: 'hline', y: 1, label: 'unit gradient' },
      {
        type: 'vline',
        x: depth,
        label: `@L=${depth}: post/pre ≈ ${ratio.toExponential(1)}`,
      },
    ],
    summary: [
      { label: 'Depth L', value: String(depth) },
      { label: 'Residual scale α', value: residualScale.toFixed(2) },
      { label: 'Per-block contraction (post)', value: contraction.toFixed(3) },
      { label: 'Pre-norm ‖∇‖ at L', value: lastPre.toFixed(3) },
      { label: 'Post-norm ‖∇‖ at L', value: lastPost.toExponential(2) },
    ],
  }
}

/**
 * GLU variants: SwiGLU vs GeGLU vs ReGLU on a 1D slice.
 *
 *   SwiGLU(x) = swish(w1·x) · (w2·x),  swish(z) = z · σ(z)
 *   GeGLU(x)  = gelu(w1·x)  · (w2·x),  gelu via tanh approximation
 *   ReGLU(x)  = relu(w1·x)  · (w2·x)
 *
 * Same gate template, three different activations on the gate branch. The
 * point of the plot is that the family agrees almost everywhere: the gate is
 * doing the heavy lifting; the activation choice is a small perturbation.
 */
export const archGluVariants: ComputeFn = (params) => {
  const w1 = asNumber(params, 'w1', 1.2)
  const w2 = asNumber(params, 'w2', 0.8)
  const range = Math.max(1, asNumber(params, 'range', 4))

  const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
  const swish = (z: number) => z * sigmoid(z)
  // tanh approximation to GELU (Hendrycks & Gimpel).
  const gelu = (z: number) => {
    const c = Math.sqrt(2 / Math.PI)
    return 0.5 * z * (1 + Math.tanh(c * (z + 0.044715 * z * z * z)))
  }
  const relu = (z: number) => Math.max(0, z)

  const samples = 241
  const points: Array<{ x: number; y: number; series?: string }> = []
  let peakSwiGLU = 0
  let peakX = 0
  for (let i = 0; i < samples; i++) {
    const x = -range + (2 * range * i) / (samples - 1)
    const gate = w2 * x
    const ySwi = swish(w1 * x) * gate
    const yGe = gelu(w1 * x) * gate
    const yRe = relu(w1 * x) * gate
    points.push({ x, y: ySwi, series: 'SwiGLU' })
    points.push({ x, y: yGe, series: 'GeGLU' })
    points.push({ x, y: yRe, series: 'ReGLU' })
    if (Math.abs(ySwi) > Math.abs(peakSwiGLU)) {
      peakSwiGLU = ySwi
      peakX = x
    }
  }

  return {
    points,
    seriesKeys: ['SwiGLU', 'GeGLU', 'ReGLU'],
    xDomain: [-range, range],
    annotations: [
      { type: 'vline', x: 0, label: 'origin' },
      { type: 'vline', x: peakX, label: `SwiGLU peak ≈ ${peakSwiGLU.toFixed(2)}` },
    ],
    summary: [
      { label: 'Gate template', value: 'act(w₁·x) · (w₂·x)' },
      { label: 'SwiGLU activation', value: 'swish (z·σ(z))' },
      { label: 'GeGLU activation', value: 'gelu (tanh approx.)' },
      { label: 'ReGLU activation', value: 'relu' },
    ],
  }
}

/**
 * Tokenizer compression and the embedding-share tradeoff.
 *
 * Heuristic: under a Zipf-distributed unigram token frequency with
 * exponent α ≈ 1, expected token length grows like log V (truncating an
 * infinite alphabet at V; the harmonic-sum normaliser makes the typical
 * token a few characters even at small V). We use
 *   bytesPerToken(V) ≈ a + b · log(V)^(1/α)
 * with a, b chosen so the curve passes through ~3.4 bytes/tok at V=32k and
 * ~4.4 bytes/tok at V=200k (roughly matching what tiktoken reports on
 * English web text). This is a teaching approximation, not a measurement.
 *
 * Second series: embedding-table parameters V·d as a fraction of the total
 * model parameters P. Two curves on shared x-axis (vocab size).
 */
export const archTokenizerCompression: ComputeFn = (params) => {
  const vocabK = Math.max(1, asNumber(params, 'vocabK', 128))
  const dim = Math.max(64, asNumber(params, 'dim', 4096))
  const totalB = Math.max(0.05, asNumber(params, 'totalB', 8))
  const zipfAlpha = Math.max(0.4, asNumber(params, 'zipfAlpha', 1))

  // Sweep vocab from 8k to 256k regardless of slider; slider sets the
  // highlighted reference point (annotation).
  const minV = 8_000
  const maxV = 256_000
  const samples = 161
  const points: Array<{ x: number; y: number; series?: string }> = []

  // Calibrate a, b so the curve hits target compression points.
  // bytesPerTok(32k)  ≈ 3.4
  // bytesPerTok(200k) ≈ 4.4
  // With f(V) = log(V)^(1/α): pick α=1 reference. We solve for a, b at α=1
  // and let α reshape the slope.
  const f = (v: number) => Math.pow(Math.log(v), 1 / zipfAlpha)
  const f1 = f(32_000)
  const f2 = f(200_000)
  const bByte = (4.4 - 3.4) / (f2 - f1)
  const aByte = 3.4 - bByte * f1
  const bytesPerTokAt = (v: number) => Math.max(1.5, aByte + bByte * f(v))

  const totalParams = totalB * 1e9
  const embedParams = (v: number) => v * dim
  const embedShareAt = (v: number) => Math.min(0.99, Math.max(0, embedParams(v) / totalParams))

  let highlightBytes = 0
  let highlightShare = 0
  const targetV = vocabK * 1000
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const v = minV * Math.pow(maxV / minV, t)
    const bpt = bytesPerTokAt(v)
    const share = embedShareAt(v)
    points.push({ x: v / 1000, y: bpt, series: 'bytes / token' })
    points.push({ x: v / 1000, y: share * 10, series: 'embedding share × 10' })
    if (Math.abs(v - targetV) < (maxV - minV) / samples) {
      highlightBytes = bpt
      highlightShare = share
    }
  }

  return {
    points,
    seriesKeys: ['bytes / token', 'embedding share × 10'],
    xDomain: [minV / 1000, maxV / 1000],
    annotations: [
      {
        type: 'vline',
        x: vocabK,
        label: `V=${vocabK}k: ${highlightBytes.toFixed(2)} B/tok, ${(highlightShare * 100).toFixed(1)}% emb`,
      },
    ],
    summary: [
      { label: 'Vocab V', value: `${vocabK}k tokens` },
      { label: 'Hidden dim d', value: String(dim) },
      { label: 'Total params P', value: `${totalB.toFixed(1)}B` },
      { label: 'Zipf α', value: zipfAlpha.toFixed(2) },
      { label: 'Bytes / token (heuristic)', value: highlightBytes.toFixed(2) },
      { label: 'Embedding-table share', value: `${(highlightShare * 100).toFixed(2)}%` },
    ],
  }
}

/**
 * Embedding-and-unembedding parameter share vs total model size.
 *
 * The embedding table has 2·V·d parameters when input and output are
 * untied (one V·d when tied). The rest of the model scales roughly with
 * d²·L, so the share E / (E + d²·L) shrinks fast as the model grows. This
 * is the empirical reason the field used to tie at 1B and is drifting away
 * from it at 70B+.
 *
 * Slider over total params P (in billions). Two series: tied (E = V·d),
 * untied (E = 2·V·d).
 */
export const archEmbeddingShare: ComputeFn = (params) => {
  const vocabK = Math.max(1, asNumber(params, 'vocabK', 128))
  const dim = Math.max(64, asNumber(params, 'dim', 4096))
  const minB = Math.max(0.1, asNumber(params, 'minB', 0.5))
  const maxB = Math.max(minB + 0.1, asNumber(params, 'maxB', 200))

  const V = vocabK * 1000
  const samples = 161
  const points: Array<{ x: number; y: number; series?: string }> = []

  let lastTied = 0
  let lastUntied = 0
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const totalB = minB * Math.pow(maxB / minB, t)
    const totalParams = totalB * 1e9
    const tied = Math.min(0.99, (V * dim) / totalParams)
    const untied = Math.min(0.99, (2 * V * dim) / totalParams)
    points.push({ x: totalB, y: tied * 100, series: 'tied (V·d)' })
    points.push({ x: totalB, y: untied * 100, series: 'untied (2·V·d)' })
    if (i === samples - 1) {
      lastTied = tied
      lastUntied = untied
    }
  }

  return {
    points,
    seriesKeys: ['tied (V·d)', 'untied (2·V·d)'],
    xDomain: [minB, maxB],
    annotations: [
      { type: 'hline', y: 10, label: '10% threshold' },
      {
        type: 'vline',
        x: maxB,
        label: `@${maxB.toFixed(0)}B: tied ${(lastTied * 100).toFixed(1)}%, untied ${(lastUntied * 100).toFixed(1)}%`,
      },
    ],
    summary: [
      { label: 'Vocab V', value: `${vocabK}k` },
      { label: 'Hidden dim d', value: String(dim) },
      { label: 'P range', value: `${minB.toFixed(1)}B – ${maxB.toFixed(0)}B` },
      { label: 'Tied share at max P', value: `${(lastTied * 100).toFixed(2)}%` },
      { label: 'Untied share at max P', value: `${(lastUntied * 100).toFixed(2)}%` },
    ],
  }
}

/**
 * Modern block edge over a vanilla GPT-2 block, with the third lift dial
 * relabelled away from RoPE (which moves to the dedicated positional post)
 * and onto QK-Norm — the late-2024 stability addition that, like RMSNorm,
 * costs almost nothing and tightens loss curves at scale.
 *
 * Identical shape to archBlockQualityPerFlop; the labelling and
 * default lifts are tuned to the new post's framing (SwiGLU + RMSNorm +
 * QK-Norm = "everything around the attention block, modernised").
 */
export const archBlockEdge: ComputeFn = (params) => {
  const swigluLift = asNumber(params, 'swigluLift', 0.04)
  const rmsLift = asNumber(params, 'rmsLift', 0.005)
  const qkNormLift = asNumber(params, 'qkNormLift', 0.015)
  const maxScale = Math.max(0.5, asNumber(params, 'maxScale', 1.5))

  // FLOP deltas as fraction of baseline block FLOPs.
  const swigluCost = 0.03
  const rmsCost = -0.01
  const qkNormCost = 0.004

  const samples = 161
  const points: Array<{ x: number; y: number; series?: string }> = []
  let lastRatio = 0
  for (let i = 0; i < samples; i++) {
    const s = (maxScale * i) / (samples - 1)
    const qModern = 1 + s * (swigluLift + rmsLift + qkNormLift)
    const fModern = 1 + s * (swigluCost + rmsCost + qkNormCost)
    const ratio = qModern / fModern
    points.push({ x: s, y: 1, series: 'vanilla GPT-2 block' })
    points.push({ x: s, y: ratio, series: 'modern block' })
    if (i === samples - 1) lastRatio = ratio
  }

  const edge = (lastRatio - 1) * 100

  return {
    points,
    seriesKeys: ['vanilla GPT-2 block', 'modern block'],
    xDomain: [0, maxScale],
    annotations: [
      { type: 'hline', y: 1, label: 'baseline' },
      {
        type: 'vline',
        x: maxScale,
        label: `edge @ full: ${edge >= 0 ? '+' : ''}${edge.toFixed(1)}%`,
      },
    ],
    summary: [
      {
        label: 'SwiGLU Δquality/ΔFLOPs',
        value: `+${(swigluLift * 100).toFixed(1)}% / +${(swigluCost * 100).toFixed(1)}%`,
      },
      {
        label: 'RMSNorm Δquality/ΔFLOPs',
        value: `+${(rmsLift * 100).toFixed(1)}% / ${(rmsCost * 100).toFixed(1)}%`,
      },
      {
        label: 'QK-Norm Δquality/ΔFLOPs',
        value: `+${(qkNormLift * 100).toFixed(1)}% / +${(qkNormCost * 100).toFixed(1)}%`,
      },
      { label: 'Composite Q/F edge', value: `${edge >= 0 ? '+' : ''}${edge.toFixed(1)}%` },
    ],
  }
}

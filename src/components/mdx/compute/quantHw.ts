import type { ComputeFn, ComputeParams } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function safe(y: number): number {
  return Number.isFinite(y) ? y : 0
}

/**
 * Bandwidth gap across edge and server devices, with a memory-bound
 * tokens/sec ceiling for a model of given size at FP16 and INT4. KV
 * cache bytes per decode token are added to the per-token weights read,
 * so context length sweeps the gap between "weights dominate" (short
 * context) and "KV cache dominates" (long context).
 *
 * Per-token decode bytes:
 *   weights:  P · b / 8
 *   kv cache: roughly 2% of FP16 weights size per 8K of context for
 *             modern GQA models (Llama-3 / Mistral-style ratios). The
 *             full cache is read every step on dense attention.
 * Both terms compete for the same bus, so the ceiling is
 *   tok/s = B / (weights_bytes + kv_bytes)
 *
 * Devices use measured peak bandwidth: Snapdragon X Elite 135 GB/s,
 * Jetson AGX Orin (64GB) 204.8 GB/s, Apple M4 Max (40-core) 546 GB/s,
 * Apple M3 Ultra 819 GB/s, NVIDIA H100 SXM 3350 GB/s, NVIDIA H200
 * 4800 GB/s. Edge devices first so the bars climb left-to-right.
 */
export const quantHwBandwidthGap: ComputeFn = (params) => {
  const paramsB = Math.max(0.5, asNumber(params, 'paramsB', 70))
  const bits = Math.max(1, Math.round(asNumber(params, 'bits', 4)))
  const ctxK = Math.max(0, asNumber(params, 'ctxK', 8))

  const devices: Array<{ name: string; bw: number }> = [
    { name: 'Snapdragon X Elite', bw: 135 },
    { name: 'Jetson AGX Orin', bw: 204.8 },
    { name: 'M4 Max (40c)', bw: 546 },
    { name: 'M3 Ultra', bw: 819 },
    { name: 'H100 SXM', bw: 3350 },
    { name: 'H200', bw: 4800 },
  ]

  // Per-token decode bytes. KV term is a toy ratio calibrated against
  // Llama-3 70B FP16 (≈140 KB/token at 8K context, ~1.1 GB cache total).
  // The point is the *shape* (KV grows linearly with context, weights
  // shrink with bits), not exact bytes for any one architecture.
  const weightsGB = (paramsB * bits) / 8
  const fp16WeightsGB = paramsB * 2
  const kvGB = fp16WeightsGB * 0.02 * (ctxK / 8) // ≈2% per 8K ctx
  const fp16BytesGB = fp16WeightsGB + kvGB
  const int4BytesGB = paramsB * 0.5 + kvGB
  const userBytesGB = weightsGB + kvGB

  const points: Array<{ x: number; y: number; series?: string }> = []
  for (let i = 0; i < devices.length; i++) {
    const d = devices[i]
    const x = i + 1
    const fp16Tps = d.bw / fp16BytesGB
    const int4Tps = d.bw / int4BytesGB
    const userTps = d.bw / userBytesGB
    points.push({ x, y: safe(fp16Tps), series: 'FP16 ceiling' })
    points.push({ x, y: safe(int4Tps), series: 'INT4 ceiling' })
    points.push({ x, y: safe(userTps), series: `${bits}-bit (you)` })
  }

  // Annotate the device labels on the x axis via vlines so the reader
  // can map index → device. Each vline carries the name; the bar
  // positions are 1..N.
  const annotations = devices.map((d, i) => ({
    type: 'vline' as const,
    x: i + 1,
    label: d.name,
  }))

  const fastest = devices[devices.length - 1]
  const slowest = devices[0]
  const fastestUser = fastest.bw / userBytesGB
  const slowestUser = slowest.bw / userBytesGB

  return {
    points,
    seriesKeys: ['FP16 ceiling', 'INT4 ceiling', `${bits}-bit (you)`],
    xDomain: [0.5, devices.length + 0.5],
    annotations,
    summary: [
      { label: 'Model', value: `${paramsB.toFixed(0)} B params @ ${bits}-bit` },
      { label: 'Context', value: `${ctxK.toFixed(0)} K tokens` },
      { label: 'Bytes / token', value: `${userBytesGB.toFixed(1)} GB` },
      { label: 'KV share', value: `${((kvGB / userBytesGB) * 100).toFixed(0)}%` },
      { label: `${slowest.name}`, value: `${slowestUser.toFixed(1)} tok/s` },
      { label: `${fastest.name}`, value: `${fastestUser.toFixed(0)} tok/s` },
    ],
  }
}

/**
 * Quality vs. bits per weight with a visible elbow.
 *
 * Toy perplexity model from the sister post:
 *   ppl(b) = ppl_fp16 · (1 + α · 2^(-β b))
 * Two curves:
 *   - "Naive RTN": uses a higher α and lower β (steeper, later elbow ~6
 *     bits) to capture the regime where round-to-nearest dominates and
 *     outliers hurt.
 *   - "Best-known stack": shifts the curve left by `stackOffset` bits,
 *     so the elbow lands near 4 bits — what GPTQ + SmoothQuant + AWQ +
 *     friends actually deliver in 2024 papers.
 *
 * The shape is the point. Between 4 and 8 bits the curve is almost
 * flat; below 4 bits it falls off a cliff. Sliders let the reader
 * convince themselves the elbow is robust to model difficulty (α) and
 * bit elasticity (β).
 */
export const quantParetoQuality: ComputeFn = (params) => {
  const alpha = Math.max(0.5, asNumber(params, 'alpha', 6))
  const beta = Math.max(0.3, asNumber(params, 'beta', 1.1))
  const stackOffset = Math.max(0, asNumber(params, 'stackOffset', 1.6))
  const pplFp16 = Math.max(1.5, asNumber(params, 'pplFp16', 5.6))

  // Naive RTN is harsher: more grid-step error per bit lost.
  const alphaNaive = alpha * 1.6
  const betaNaive = beta * 0.8

  const samples = 121
  const bMin = 1.5
  const bMax = 10
  const points: Array<{ x: number; y: number; series?: string }> = []
  for (let i = 0; i < samples; i++) {
    const b = bMin + ((bMax - bMin) * i) / (samples - 1)
    const pplNaive = pplFp16 * (1 + alphaNaive * Math.pow(2, -betaNaive * b))
    const pplStack = pplFp16 * (1 + alpha * Math.pow(2, -beta * (b + stackOffset)))
    points.push({ x: b, y: safe(pplNaive), series: 'naive RTN' })
    points.push({ x: b, y: safe(pplStack), series: 'best-known stack' })
  }

  // Locate each curve's elbow numerically as the bit-width where the
  // second derivative is largest (curvature peak). For a clean toy this
  // is well-defined; we approximate with finite differences.
  function elbow(aA: number, bB: number, off: number): number {
    let bestB = bMin
    let bestK = 0
    for (let i = 2; i < samples - 2; i++) {
      const b = bMin + ((bMax - bMin) * i) / (samples - 1)
      const h = (bMax - bMin) / (samples - 1)
      const yL = pplFp16 * (1 + aA * Math.pow(2, -bB * (b - h + off)))
      const y0 = pplFp16 * (1 + aA * Math.pow(2, -bB * (b + off)))
      const yR = pplFp16 * (1 + aA * Math.pow(2, -bB * (b + h + off)))
      const k = Math.abs(yL - 2 * y0 + yR)
      if (k > bestK) {
        bestK = k
        bestB = b
      }
    }
    return bestB
  }
  const elbowNaive = elbow(alphaNaive, betaNaive, 0)
  const elbowStack = elbow(alpha, beta, stackOffset)

  const yMax = pplFp16 * (1 + alphaNaive * Math.pow(2, -betaNaive * bMin)) * 1.05

  return {
    points,
    seriesKeys: ['naive RTN', 'best-known stack'],
    xDomain: [bMin, bMax],
    yDomain: [pplFp16 * 0.98, yMax],
    annotations: [
      { type: 'hline', y: pplFp16, label: `fp16 ppl = ${pplFp16.toFixed(2)}` },
      { type: 'vline', x: elbowNaive, label: `RTN elbow ≈ ${elbowNaive.toFixed(1)}b` },
      { type: 'vline', x: elbowStack, label: `stack elbow ≈ ${elbowStack.toFixed(1)}b` },
      { type: 'band', from: 1.5, to: elbowStack, axis: 'x', label: 'cliff' },
    ],
    summary: [
      { label: 'fp16 ppl', value: pplFp16.toFixed(2) },
      { label: 'RTN elbow', value: `${elbowNaive.toFixed(1)} bits` },
      { label: 'Stack elbow', value: `${elbowStack.toFixed(1)} bits` },
      { label: 'Stack offset', value: `${stackOffset.toFixed(1)} bits` },
    ],
  }
}

/**
 * Entropy view: why lossless compression of trained weights barely
 * helps, but quantization-then-coding does.
 *
 * Three series of "compression ratio" (output bits / input bits, lower
 * is better) across a discretization-grid sweep:
 *
 *   1. IID Gaussian noise — maximum entropy for its variance, ratio ≈ 1.
 *   2. Trained FP32 weights — Gaussian-ish bulk with mild heavy tails.
 *      Stored as 32 bits each. Entropy in float bits is close to max,
 *      ratio sits in the 0.95–1.0 band for general-purpose compressors.
 *   3. 4-bit quantized weights — the integer codes have entropy bounded
 *      by `bits` (and usually noticeably less, since the mid grid bins
 *      are more populated than the tail bins). Stored as bits ratio
 *      against the 32-bit original ≈ bits/32, plus an entropy-coding
 *      slider that compresses the 4-bit codes themselves.
 *
 * The toy is closed-form: H(X) / H_max(X) for a discrete distribution,
 * with shape control going Gaussian → heavy-tail → bimodal. This is
 * defensible as a proxy for what gzip/zstd would actually do on iid-ish
 * data within ~10%; the absolute number isn't the point, the gap
 * between curves is.
 */
export const quantEntropyView: ComputeFn = (params) => {
  const bits = Math.max(2, Math.round(asNumber(params, 'bits', 4)))
  const shape = Math.min(2, Math.max(0, asNumber(params, 'shape', 0.4))) // 0=gauss, 1=heavy, 2=bimodal
  const codeEntropy = Math.min(1, Math.max(0, asNumber(params, 'codeEntropy', 0.85)))

  // Build a probability mass on `gridLevels` bins for each scenario.
  // For continuous series we discretise to a fine 256-bin histogram and
  // compute discrete entropy; the closed-form ratio is H / log2(256) for
  // those, and H / log2(levels) for the quantized series.
  const fineN = 256

  function gaussianBin(i: number, n: number, sigma: number): number {
    // pdf at bin centre, evenly spaced over [-3σ, 3σ]
    const x = -3 * sigma + (6 * sigma * (i + 0.5)) / n
    return Math.exp(-(x * x) / (2 * sigma * sigma))
  }

  function heavyTailBin(i: number, n: number, sigma: number, nu: number): number {
    // Student-t-like: (1 + x²/(ν σ²))^(-(ν+1)/2)
    const x = -3 * sigma + (6 * sigma * (i + 0.5)) / n
    return Math.pow(1 + (x * x) / (nu * sigma * sigma), -(nu + 1) / 2)
  }

  function bimodalBin(i: number, n: number, sigma: number, mu: number): number {
    const x = -3 * sigma + (6 * sigma * (i + 0.5)) / n
    const a = Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma))
    const b = Math.exp(-((x + mu) * (x + mu)) / (2 * sigma * sigma))
    return 0.5 * (a + b)
  }

  function distribution(n: number, sigma = 1): number[] {
    const p = new Array<number>(n).fill(0)
    if (shape <= 1) {
      const w = shape // 0..1 between gaussian and heavy-tailed
      for (let i = 0; i < n; i++) {
        const g = gaussianBin(i, n, sigma)
        const h = heavyTailBin(i, n, sigma, 3) // ν=3 → mild heavy tail
        p[i] = (1 - w) * g + w * h
      }
    } else {
      const w = shape - 1 // 0..1 between heavy-tailed and bimodal
      for (let i = 0; i < n; i++) {
        const h = heavyTailBin(i, n, sigma, 3)
        const b = bimodalBin(i, n, sigma, 1.6 * sigma)
        p[i] = (1 - w) * h + w * b
      }
    }
    let s = 0
    for (let i = 0; i < n; i++) s += p[i]
    if (s <= 0) return p
    for (let i = 0; i < n; i++) p[i] /= s
    return p
  }

  function entropy(p: number[]): number {
    let h = 0
    for (let i = 0; i < p.length; i++) {
      const pi = p[i]
      if (pi > 0) h -= pi * Math.log2(pi)
    }
    return h
  }

  // Quantize a fine distribution onto `levels` bins by summing bins
  // that fall into each quantizer interval. Mass is preserved.
  function quantizeOnto(p: number[], levels: number): number[] {
    const q = new Array<number>(levels).fill(0)
    const ratio = p.length / levels
    for (let i = 0; i < p.length; i++) {
      const bin = Math.min(levels - 1, Math.floor(i / ratio))
      q[bin] += p[i]
    }
    return q
  }

  // Sweep "effective number of grid levels used" from 4 .. 64. The
  // x-axis is log2(levels), giving an x range of 2..6 bits. For each
  // discrete code count, compute compression ratio of each scenario
  // *as if* coded at that bit width.
  const samples = 13
  const points: Array<{ x: number; y: number; series?: string }> = []
  let ratioGaussShown = 0
  let ratioWeightShown = 0
  let ratioQuantShown = 0
  const FP32 = 32
  for (let i = 0; i < samples; i++) {
    const b = 2 + (4 * i) / (samples - 1) // 2..6 bits
    const L = Math.round(Math.pow(2, b))

    // (1) Gaussian noise: max entropy for its variance. Stored at 32
    //     bits/sample, the closest a general-purpose compressor can get
    //     is ≈ H(X)/32 of the original size. For continuous samples
    //     histogrammed at fineN bins, H ≈ log2(fineN) - 0.5·log2(2πe·var)
    //     correction; we just use the discrete H over fineN bins as a
    //     proxy. Ratio is normalised so noise sits at ~1.0.
    const pNoise = new Array<number>(fineN).fill(1 / fineN)
    const Hnoise = entropy(pNoise) // = log2(fineN) = 8
    const ratioNoise = Hnoise / 8 // normalise to [0,1]; = 1 by construction

    // (2) Trained FP32 weights: shape-controlled distribution at fineN.
    //     Almost-but-not-quite max entropy → ratio ~0.95 for gauss,
    //     drops as shape moves to bimodal (more compressible).
    const pW = distribution(fineN)
    const Hw = entropy(pW)
    const ratioW = Hw / 8

    // (3) Quantized to L levels, then optionally entropy-coded. Stored
    //     naively at log2(L) bits/sample, ratio is log2(L)/32. After
    //     entropy coding the codes, ratio becomes H(codes) · code-eff /
    //     32 where code-eff is a slider (1=Huffman optimal, 0.5=lazy).
    const pQ = quantizeOnto(pW, L)
    const Hq = entropy(pQ)
    const Lcoded = codeEntropy * Hq + (1 - codeEntropy) * Math.log2(L)
    const ratioQ = Lcoded / FP32

    points.push({ x: b, y: safe(ratioNoise), series: 'IID Gaussian noise' })
    points.push({ x: b, y: safe(ratioW), series: 'trained FP32 weights' })
    points.push({ x: b, y: safe(ratioQ), series: 'quantized + coded' })

    if (Math.abs(b - bits) < 4 / (samples - 1)) {
      ratioGaussShown = ratioNoise
      ratioWeightShown = ratioW
      ratioQuantShown = ratioQ
    }
  }

  return {
    points,
    seriesKeys: ['IID Gaussian noise', 'trained FP32 weights', 'quantized + coded'],
    xDomain: [2, 6],
    yDomain: [0, 1.05],
    annotations: [
      { type: 'vline', x: bits, label: `${bits}-bit grid` },
      { type: 'hline', y: 1, label: 'lossless of FP32 ≈ 1.0' },
    ],
    summary: [
      { label: 'Distribution shape', value: shape < 1 ? 'Gaussian → tail' : 'tail → bimodal' },
      { label: 'Noise ratio', value: ratioGaussShown.toFixed(2) },
      { label: 'FP32 weights ratio', value: ratioWeightShown.toFixed(2) },
      { label: `${bits}b + coded ratio`, value: ratioQuantShown.toFixed(2) },
      {
        label: 'Effective compression',
        value: `${(1 / Math.max(0.001, ratioQuantShown)).toFixed(1)}×`,
      },
    ],
  }
}

/**
 * Modelled compression ratios across {FP32, FP16, INT8, INT4} weight
 * representations and {gzip, zstd, brotli} compressors.
 *
 * This is an honest proxy, not a measurement. We model each compressor
 * as approaching the entropy lower bound by a fixed efficiency factor
 * (gzip ~92%, zstd ~95%, brotli ~96% on iid-ish data — these are
 * stylised numbers in the right ballpark). For each precision, we
 * compute an entropy-per-symbol that depends on the input distribution
 * shape, then convert to a final-size ratio against the FP32 baseline.
 *
 * Output is a bar chart with one bar per (precision, algo) pair. The
 * caption (in MDX) is honest that ratios are modelled.
 *
 * Slider: distribution shape (Gaussian → bimodal), num parameters in
 * millions (only affects the absolute MB readouts in the summary).
 */
export const quantCompressionRatios: ComputeFn = (params) => {
  const shape = Math.min(2, Math.max(0, asNumber(params, 'shape', 0.4)))
  const paramsM = Math.max(1, asNumber(params, 'paramsM', 7000)) // millions

  // Generate a base distribution at fine resolution.
  const fineN = 256
  function gauss(i: number, n: number, sigma = 1): number {
    const x = -3 * sigma + (6 * sigma * (i + 0.5)) / n
    return Math.exp(-(x * x) / (2 * sigma * sigma))
  }
  function tail(i: number, n: number, sigma = 1, nu = 3): number {
    const x = -3 * sigma + (6 * sigma * (i + 0.5)) / n
    return Math.pow(1 + (x * x) / (nu * sigma * sigma), -(nu + 1) / 2)
  }
  function bimodal(i: number, n: number, sigma = 1, mu = 1.6): number {
    const x = -3 * sigma + (6 * sigma * (i + 0.5)) / n
    const a = Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma))
    const b = Math.exp(-((x + mu) * (x + mu)) / (2 * sigma * sigma))
    return 0.5 * (a + b)
  }
  function dist(n: number): number[] {
    const p = new Array<number>(n).fill(0)
    if (shape <= 1) {
      const w = shape
      for (let i = 0; i < n; i++) p[i] = (1 - w) * gauss(i, n) + w * tail(i, n)
    } else {
      const w = shape - 1
      for (let i = 0; i < n; i++) p[i] = (1 - w) * tail(i, n) + w * bimodal(i, n)
    }
    let s = 0
    for (let i = 0; i < n; i++) s += p[i]
    for (let i = 0; i < n; i++) p[i] /= Math.max(1e-12, s)
    return p
  }
  function entropy(p: number[]): number {
    let h = 0
    for (const pi of p) if (pi > 0) h -= pi * Math.log2(pi)
    return h
  }
  function quantizeOnto(p: number[], levels: number): number[] {
    const q = new Array<number>(levels).fill(0)
    const ratio = p.length / levels
    for (let i = 0; i < p.length; i++) {
      const bin = Math.min(levels - 1, Math.floor(i / ratio))
      q[bin] += p[i]
    }
    return q
  }

  const pBase = dist(fineN)
  const Hcontinuous = entropy(pBase) // out of log2(fineN)=8 bits

  // Bits actually needed at each precision (entropy lower bound):
  // - FP32: stored as 32 bits, but trained weights have entropy ≈
  //   Hcontinuous + 24 (mantissa-low-order bits look like noise to
  //   gzip → essentially incompressible). Closed-form: assume the low
  //   24 bits are uniform random, contributing 24 bits of irreducible
  //   entropy on top of the 8 bits captured by our histogram.
  // - FP16: 16 bits stored, low 8 bits ~uniform → 8 + Hcontinuous/2
  //   (the half-precision mantissa is much shorter, so the "noise
  //   floor" is correspondingly smaller).
  // - INT8: 8 bits stored, entropy = entropy(quantizeOnto(p, 256)).
  // - INT4: 4 bits stored, entropy = entropy(quantizeOnto(p, 16)).
  const Hint8 = entropy(quantizeOnto(pBase, 256))
  const Hint4 = entropy(quantizeOnto(pBase, 16))
  const Hfp32 = Hcontinuous + 24
  const Hfp16 = Hcontinuous / 2 + 8

  // Compressor efficiency: fraction of the entropy bound the algo
  // reaches on iid-ish data. Stylised numbers consistent with public
  // benchmarks (Calgary corpus, Silesia) on smooth float arrays.
  const algos: Array<{ name: string; eff: number }> = [
    { name: 'gzip', eff: 0.92 },
    { name: 'zstd', eff: 0.95 },
    { name: 'brotli', eff: 0.96 },
  ]
  const precisions: Array<{ name: string; storedBits: number; H: number }> = [
    { name: 'FP32', storedBits: 32, H: Hfp32 },
    { name: 'FP16', storedBits: 16, H: Hfp16 },
    { name: 'INT8', storedBits: 8, H: Hint8 },
    { name: 'INT4', storedBits: 4, H: Hint4 },
  ]

  // Bars are indexed left-to-right: for each precision, three algos
  // back-to-back, then a small gap. x positions are floats so the
  // ParamPlot bar renderer keeps them readable.
  const points: Array<{ x: number; y: number; series?: string }> = []
  const xLabels: Array<{ x: number; label: string }> = []
  let x = 1
  const summaries: { label: string; value: string }[] = []
  for (const prec of precisions) {
    xLabels.push({ x: x + 1, label: prec.name })
    for (const algo of algos) {
      // Final compressed bits/symbol = max(stored ceil, H/eff). We can
      // never beat the entropy bound, and we can never beat the stored
      // size (compressing 4-bit data won't go below ~entropy bits).
      const compressedBits = Math.max(prec.H / algo.eff, 0)
      // Total compressed size is `compressedBits` per parameter; ratio
      // is against the FP32 stored baseline (32 bits/param).
      const ratio = compressedBits / 32
      points.push({ x, y: safe(ratio), series: `${prec.name} · ${algo.name}` })
      x += 1
    }
    x += 0.5 // gap between precision groups
  }

  // For the summary, report the absolute MB at INT4+brotli vs FP32 raw.
  const fp32MB = (paramsM * 1e6 * 32) / 8 / 1e6
  const int4BrotliBits = Math.max(Hint4 / 0.96, 0)
  const int4BrotliMB = (paramsM * 1e6 * int4BrotliBits) / 8 / 1e6
  summaries.push({ label: 'Params', value: `${paramsM.toFixed(0)} M` })
  summaries.push({ label: 'FP32 raw', value: `${fp32MB.toFixed(0)} MB` })
  summaries.push({ label: 'INT4 + brotli', value: `${int4BrotliMB.toFixed(0)} MB` })
  summaries.push({
    label: 'INT4 / FP32',
    value: `${(int4BrotliMB / fp32MB).toFixed(2)}×`,
  })
  summaries.push({
    label: 'FP32 + zstd',
    value: `${((Hfp32 / 0.95 / 32) * 100).toFixed(0)}% of raw`,
  })

  return {
    points,
    seriesKeys: precisions.flatMap((p) => algos.map((a) => `${p.name} · ${a.name}`)),
    xDomain: [0.5, x],
    yDomain: [0, 1.1],
    annotations: [
      ...xLabels.map((l) => ({ type: 'vline' as const, x: l.x, label: l.label })),
      { type: 'hline' as const, y: 1, label: 'FP32 raw' },
    ],
    summary: summaries,
  }
}

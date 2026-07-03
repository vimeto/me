import type { ComputeFn, ComputeParams } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * LoRA capture: expected fraction of an isotropic unit update direction that
 * lies inside a random rank-r subspace of R^d.
 *
 * If we pick a uniformly random r-dimensional subspace S ⊂ R^d and a random
 * unit vector u ∈ R^d, then E[||Proj_S(u)||²] = r/d. This is the "how much of
 * the update direction do I capture" curve: linear in r, with slope 1/d.
 *
 * We plot capture vs r for one choice of d, and overlay a couple of reference
 * dimensions as hlines for intuition.
 */
export const tttLoraCapture: ComputeFn = (params) => {
  const d = Math.max(8, Math.round(asNumber(params, 'd', 1024)))
  const rMax = Math.min(d, Math.max(1, Math.round(asNumber(params, 'rMax', 128))))
  const target = Math.min(0.99, Math.max(0.01, asNumber(params, 'target', 0.5)))

  const samples = 201
  const points: Array<{ x: number; y: number; series?: string }> = []
  // Main curve: random-subspace capture = r/d.
  for (let i = 0; i < samples; i++) {
    const r = 1 + ((rMax - 1) * i) / (samples - 1)
    const y = Math.min(1, r / d)
    points.push({ x: r, y, series: `random rank-r in R^${d}` })
  }
  // Reference curve: a "concentrated" gradient where the top-r coordinates
  // already carry most of the mass (power-law decay a_k ~ k^-0.8). Shows that
  // real gradients are not isotropic — LoRA can capture far more than r/d
  // when the update is itself low-rank-ish.
  const alpha = Math.max(0.1, asNumber(params, 'alpha', 0.8))
  const weights: number[] = []
  let total = 0
  for (let k = 1; k <= d; k++) {
    const w = Math.pow(k, -alpha)
    weights.push(w * w)
    total += w * w
  }
  const cum: number[] = []
  let acc = 0
  for (const w of weights) {
    acc += w / total
    cum.push(acc)
  }
  for (let i = 0; i < samples; i++) {
    const r = 1 + ((rMax - 1) * i) / (samples - 1)
    const idx = Math.min(d - 1, Math.max(0, Math.round(r) - 1))
    points.push({ x: r, y: cum[idx], series: `power-law grad (α=${alpha.toFixed(1)})` })
  }

  // Find the smallest r that reaches `target` capture for each series.
  const rRandom = Math.ceil(target * d)
  let rPower = rMax
  for (let k = 0; k < cum.length; k++) {
    if (cum[k] >= target) {
      rPower = k + 1
      break
    }
  }

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = [{ type: 'hline', y: target, label: `target = ${(target * 100).toFixed(0)}%` }]
  if (rRandom <= rMax) {
    annotations.push({ type: 'vline', x: rRandom, label: `random: r=${rRandom}` })
  }
  if (rPower <= rMax) {
    annotations.push({ type: 'vline', x: rPower, label: `power-law: r=${rPower}` })
  }

  return {
    points,
    xDomain: [1, rMax],
    yDomain: [0, 1],
    seriesKeys: [`random rank-r in R^${d}`, `power-law grad (α=${alpha.toFixed(1)})`],
    annotations,
    summary: [
      { label: 'Model width d', value: String(d) },
      {
        label: 'r for random to hit target',
        value: rRandom <= rMax ? String(rRandom) : `> ${rMax}`,
      },
      {
        label: 'r for power-law to hit target',
        value: rPower <= rMax ? String(rPower) : `> ${rMax}`,
      },
    ],
  }
}

/**
 * Trajectory on a toy 2D quadratic: f(x, y) = 0.5 * (x² + c · y²).
 *
 * Full SGD: gradient descent on both coordinates.
 * LoRA (rank-1): same gradient descent, but the update is projected onto a
 * fixed 1D subspace given by an angle θ. θ = 0 → only the x-axis moves; the
 * y-coordinate never decreases. This is the LoRA-in-2D picture: if the
 * minimum is off-axis and the chosen subspace misses it, the trajectory
 * stalls on the subspace closest to the origin.
 */
export const tttTrajectory: ComputeFn = (params) => {
  const lr = Math.max(1e-4, asNumber(params, 'lr', 0.15))
  const steps = Math.max(2, Math.min(400, Math.round(asNumber(params, 'steps', 60))))
  const curvature = Math.max(0.2, asNumber(params, 'curvature', 5))
  const theta = asNumber(params, 'theta', 0) // radians; 0 means x-axis
  const x0 = asNumber(params, 'x0', 1.6)
  const y0 = asNumber(params, 'y0', 1.2)

  const points: Array<{ x: number; y: number; series?: string }> = []

  // Full SGD.
  let fx = x0
  let fy = y0
  points.push({ x: fx, y: fy, series: 'full SGD' })
  for (let s = 0; s < steps; s++) {
    const gx = fx
    const gy = curvature * fy
    fx = fx - lr * gx
    fy = fy - lr * gy
    points.push({ x: fx, y: fy, series: 'full SGD' })
  }

  // LoRA rank-1: project gradient onto unit vector u = (cos θ, sin θ).
  const ux = Math.cos(theta)
  const uy = Math.sin(theta)
  let lxp = x0
  let lyp = y0
  points.push({ x: lxp, y: lyp, series: 'LoRA rank-1' })
  for (let s = 0; s < steps; s++) {
    const gx = lxp
    const gy = curvature * lyp
    const dot = gx * ux + gy * uy
    lxp = lxp - lr * dot * ux
    lyp = lyp - lr * dot * uy
    points.push({ x: lxp, y: lyp, series: 'LoRA rank-1' })
  }

  // Frame both trajectories with a bit of padding.
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMin = Math.min(...xs, -0.2)
  const xMax = Math.max(...xs, 0.2)
  const yMin = Math.min(...ys, -0.2)
  const yMax = Math.max(...ys, 0.2)
  const pad = 0.2

  const finalFull = Math.hypot(fx, fy)
  const finalLora = Math.hypot(lxp, lyp)
  const diverged =
    !Number.isFinite(finalFull) || !Number.isFinite(finalLora) || finalFull > 100 || finalLora > 100

  return {
    points,
    xDomain: [xMin - pad, xMax + pad],
    yDomain: [yMin - pad, yMax + pad],
    seriesKeys: ['full SGD', 'LoRA rank-1'],
    annotations: [
      { type: 'vline', x: 0, label: 'minimum' },
      { type: 'hline', y: 0 },
    ],
    summary: [
      { label: 'Final |θ| full SGD', value: finalFull.toFixed(3) },
      { label: 'Final |θ| LoRA r=1', value: finalLora.toFixed(3) },
      { label: 'Diverged?', value: diverged ? 'yes' : 'no' },
    ],
  }
}

/**
 * Adaptation curve: loss vs TTT step count for different learning rates.
 *
 * Stable regime:    L(t) = L0 · exp(-η · t) + ε
 * Unstable regime:  if η > ηCrit, the step overshoots and we model
 *                   L(t) = L0 · ((η / ηCrit) - 1)^t — geometric blow-up.
 *
 * We sweep three η values: under-, well-tuned, and too-large. The too-large
 * series goes vertical quickly; we clamp and mark it with a "diverged" band.
 */
export const tttAdaptCurve: ComputeFn = (params) => {
  const etaSmall = Math.max(1e-4, asNumber(params, 'etaSmall', 0.02))
  const etaGood = Math.max(1e-4, asNumber(params, 'etaGood', 0.15))
  const etaBig = Math.max(1e-4, asNumber(params, 'etaBig', 0.45))
  const L0 = Math.max(0.01, asNumber(params, 'L0', 1))
  const etaCrit = Math.max(1e-3, asNumber(params, 'etaCrit', 0.35))
  const steps = Math.max(10, Math.min(300, Math.round(asNumber(params, 'steps', 80))))
  const noise = Math.max(0, asNumber(params, 'noise', 0.01))

  const points: Array<{ x: number; y: number; series?: string }> = []
  const yCap = L0 * 4

  function simulate(eta: number, label: string) {
    let diverged = false
    for (let t = 0; t <= steps; t++) {
      let y: number
      if (eta <= etaCrit) {
        y = L0 * Math.exp(-eta * t) + noise
      } else {
        // Deterministic overshoot model — no RNG so the curve stays stable
        // across re-renders.
        const g = eta / etaCrit - 1
        y = L0 * Math.pow(1 + g, t)
      }
      if (!Number.isFinite(y) || y > yCap) {
        y = yCap
        diverged = true
      }
      points.push({ x: t, y, series: label })
      if (diverged) break
    }
  }

  simulate(etaSmall, `η = ${etaSmall.toFixed(3)} (small)`)
  simulate(etaGood, `η = ${etaGood.toFixed(3)} (good)`)
  simulate(etaBig, `η = ${etaBig.toFixed(3)} (too big)`)

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = [{ type: 'hline', y: noise, label: 'noise floor' }]

  if (etaBig > etaCrit) {
    annotations.push({ type: 'band', from: yCap * 0.8, to: yCap, axis: 'y', label: 'diverged' })
  }

  const lossGood = L0 * Math.exp(-etaGood * steps) + noise

  return {
    points,
    xDomain: [0, steps],
    yDomain: [0, yCap],
    seriesKeys: [
      `η = ${etaSmall.toFixed(3)} (small)`,
      `η = ${etaGood.toFixed(3)} (good)`,
      `η = ${etaBig.toFixed(3)} (too big)`,
    ],
    annotations,
    summary: [
      { label: 'Critical η', value: etaCrit.toFixed(3) },
      { label: 'Loss at T, good η', value: lossGood.toFixed(3) },
      { label: 'Big η stable?', value: etaBig <= etaCrit ? 'yes' : 'no (diverged)' },
    ],
  }
}

/**
 * Compute budget: latency vs quality as a function of LoRA rank r at test time.
 *
 * Latency model:  ℓ(r) = ℓ0 + r · c
 * Quality model:  q(r) = 1 - exp(-r / τ)
 *
 * We plot quality vs latency as a Pareto-style curve, sweeping r from 1..rMax.
 * The "knee" is the smallest r that reaches 80% of the adaptation ceiling (the
 * q achievable at rMax) — the heuristic prose argues for: "the smallest rank
 * that reaches, say, 80% of the adaptation ceiling". A latency-budget band
 * is drawn past `budgetMs`.
 */
export const tttBudget: ComputeFn = (params) => {
  const baseLatency = Math.max(0, asNumber(params, 'baseLatency', 20))
  const perRankCost = Math.max(0.01, asNumber(params, 'perRankCost', 1.2))
  const tau = Math.max(0.5, asNumber(params, 'tau', 8))
  const rMax = Math.max(4, Math.min(256, Math.round(asNumber(params, 'rMax', 64))))
  const budgetMs = Math.max(baseLatency, asNumber(params, 'budgetMs', 80))

  const samples = Math.min(rMax, 200)
  const points: Array<{ x: number; y: number; series?: string }> = []

  const qCeiling = 1 - Math.exp(-rMax / tau)
  const qKneeTarget = 0.8 * qCeiling
  let bestKnee = rMax
  for (let i = 0; i < samples; i++) {
    const r = 1 + ((rMax - 1) * i) / (samples - 1)
    const latency = baseLatency + r * perRankCost
    const quality = 1 - Math.exp(-r / tau)
    if (quality >= qKneeTarget && r < bestKnee) bestKnee = r
    points.push({ x: latency, y: quality, series: 'Pareto frontier' })
  }

  const kneeLatency = baseLatency + bestKnee * perRankCost
  const maxLatency = baseLatency + rMax * perRankCost

  const annotations: Array<
    | { type: 'vline'; x: number; label?: string }
    | { type: 'hline'; y: number; label?: string }
    | { type: 'band'; from: number; to: number; label?: string; axis?: 'x' | 'y' }
  > = [
    { type: 'vline', x: kneeLatency, label: `knee (80% of ceiling) ≈ r=${bestKnee.toFixed(0)}` },
    { type: 'vline', x: budgetMs, label: `budget = ${budgetMs.toFixed(0)} ms` },
  ]
  if (budgetMs < maxLatency) {
    annotations.push({
      type: 'band',
      from: budgetMs,
      to: maxLatency,
      axis: 'x',
      label: 'over budget',
    })
  }

  const rAtBudget = Math.max(1, Math.floor((budgetMs - baseLatency) / perRankCost))
  const qAtBudget = 1 - Math.exp(-rAtBudget / tau)

  return {
    points,
    xDomain: [baseLatency, maxLatency],
    yDomain: [0, 1],
    seriesKeys: ['Pareto frontier'],
    annotations,
    summary: [
      { label: 'Base latency', value: `${baseLatency.toFixed(1)} ms` },
      { label: 'Ceiling quality', value: `${(qCeiling * 100).toFixed(1)}%` },
      { label: 'Knee rank (80% ceiling)', value: bestKnee.toFixed(0) },
      { label: 'Quality at budget', value: `${(qAtBudget * 100).toFixed(1)}%` },
    ],
  }
}

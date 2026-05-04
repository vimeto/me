import { useMemo, useState } from 'react'
import { scaleLinear } from '@visx/scale'
import { Group } from '@visx/group'
import { LinePath, AreaClosed, Bar } from '@visx/shape'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { ParamPlotProps } from '@/schemas/blocks'
import type { ComputeParams, ComputeResult, Point } from '../compute'
import { getCompute } from '../compute'
import { Plot, type PlotDims } from '../primitives/Plot'
import { Slider } from '../primitives/Slider'
import { Range } from '../primitives/Range'
import { ParamPlayground } from '../primitives/ParamPlayground'
import {
  plotChrome,
  series,
  seriesAt,
  seriesOrder,
  textureIds,
  type SeriesKey,
} from '../theme/tokens'

type FormatKind = 'int' | 'decimal' | 'percent' | undefined

function formatter(kind: FormatKind) {
  if (kind === 'int') return (v: number) => Math.round(v).toString()
  if (kind === 'percent')
    return (v: number) => {
      const pct = v * 100
      return pct === Math.round(pct) ? `${pct}%` : `${pct.toFixed(1)}%`
    }
  if (kind === 'decimal') return (v: number) => v.toFixed(2)
  return (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(2))
}

type SeriesGroup = {
  /** Name shown in legend; undefined when the points carry no `series` field. */
  name: string | undefined
  points: Point[]
  paletteKey: SeriesKey
}

function groupBySeries(result: ComputeResult): SeriesGroup[] {
  const groups = new Map<string | undefined, Point[]>()
  for (const p of result.points) {
    const key = p.series
    const arr = groups.get(key) ?? []
    arr.push(p)
    groups.set(key, arr)
  }
  // Ordering: explicit seriesKeys first (filtered to ones we actually have),
  // then any unknown groups in insertion order (including the unnamed group).
  const orderedNames: (string | undefined)[] = []
  if (result.seriesKeys) {
    for (const k of result.seriesKeys) {
      if (groups.has(k) && !orderedNames.includes(k)) orderedNames.push(k)
    }
  }
  for (const k of groups.keys()) {
    if (!orderedNames.includes(k)) orderedNames.push(k)
  }
  return orderedNames.map((name, i) => ({
    name,
    points: groups.get(name) ?? [],
    paletteKey: seriesOrder[i % seriesOrder.length],
  }))
}

export function ParamPlot(rawProps: unknown) {
  const props = ParamPlotProps.parse(rawProps)
  const compute = getCompute(props.compute)

  const initial: ComputeParams = useMemo(() => {
    const p: ComputeParams = { ...props.params }
    for (const c of props.controls) {
      if (p[c.param] === undefined) {
        if (c.kind === 'range') {
          p[c.param + '.min'] = c.min
          p[c.param + '.max'] = c.max
        } else {
          p[c.param] = (c.min + c.max) / 2
        }
      }
    }
    return p
  }, [props])

  const [state, setState] = useState<ComputeParams>(initial)

  const result: ComputeResult = useMemo(
    () => (compute ? compute(state) : { points: [] }),
    [compute, state]
  )

  const groups = useMemo(() => groupBySeries(result), [result])

  if (!compute) {
    return (
      <div className="not-prose my-4 rounded-md border-2 border-destructive/70 bg-destructive/5 px-4 py-3 text-sm">
        <strong className="block font-semibold">ParamPlot error</strong>
        Unknown compute key <code className="font-mono">{props.compute}</code>. Register it in{' '}
        <code className="font-mono">src/components/mdx/compute/index.ts</code>.
      </div>
    )
  }

  const allXs = result.points.map((p) => p.x)
  const allYs = result.points.map((p) => p.y)
  const xDomain = result.xDomain ?? extent(allXs)
  const yDomain = result.yDomain ?? extent(allYs)

  // Show legend only when we have at least two named series.
  const namedGroups = groups.filter((g) => g.name !== undefined)
  const showLegend = namedGroups.length >= 2

  const controlsNode = (
    <>
      {props.controls.map((c) => {
        const fmt = formatter(c.format)
        if (c.kind === 'slider') {
          const value = typeof state[c.param] === 'number' ? (state[c.param] as number) : c.min
          return (
            <Slider
              key={c.param}
              label={c.label}
              min={c.min}
              max={c.max}
              step={c.step}
              value={value}
              onChange={(v) => setState((s) => ({ ...s, [c.param]: v }))}
              format={fmt}
              hint={c.hint}
            />
          )
        }
        const lo =
          typeof state[c.param + '.min'] === 'number' ? (state[c.param + '.min'] as number) : c.min
        const hi =
          typeof state[c.param + '.max'] === 'number' ? (state[c.param + '.max'] as number) : c.max
        return (
          <Range
            key={c.param}
            label={c.label}
            min={c.min}
            max={c.max}
            step={c.step}
            value={[lo, hi]}
            onChange={([a, b]) =>
              setState((s) => ({
                ...s,
                [c.param + '.min']: a,
                [c.param + '.max']: b,
              }))
            }
            format={fmt}
            hint={c.hint}
          />
        )
      })}
      {result.summary && result.summary.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-t-2 border-foreground/20 pt-3">
          {result.summary.map((s) => (
            <div key={s.label} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <span className="font-mono tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <ParamPlayground title={props.title} controls={controlsNode}>
      <div className="flex flex-col gap-2">
        {showLegend && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {namedGroups.map((g) => {
              const s = series[g.paletteKey]
              return (
                <span key={String(g.name)} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-4 rounded-sm"
                    style={{ background: s.stroke }}
                  />
                  <span className="text-muted-foreground">{g.name}</span>
                </span>
              )
            })}
          </div>
        )}
        <Plot
          ariaLabel={props.title ?? props.compute}
          caption={props.caption}
          height={props.height ?? 320}
        >
          {(dims) => (
            <PlotBody
              dims={dims}
              result={result}
              groups={groups}
              xDomain={xDomain}
              yDomain={yDomain}
              kind={props.kind}
              xLabel={props.xLabel}
              yLabel={props.yLabel}
            />
          )}
        </Plot>
      </div>
    </ParamPlayground>
  )
}

function extent(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  let min = values[0]
  let max = values[0]
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === max) return [min - 0.5, max + 0.5]
  return [min, max]
}

function PlotBody({
  dims,
  result,
  groups,
  xDomain,
  yDomain,
  kind,
  xLabel,
  yLabel,
}: {
  dims: PlotDims
  result: ComputeResult
  groups: SeriesGroup[]
  xDomain: [number, number]
  yDomain: [number, number]
  kind: 'line' | 'area' | 'bar'
  xLabel?: string
  yLabel?: string
}) {
  const { inner, margin } = dims
  const xScale = scaleLinear({ domain: xDomain, range: [0, inner.width] })
  const yScale = scaleLinear({ domain: yDomain, range: [inner.height, 0], nice: true })
  // Use first series for chrome/annotations to keep the contrast consistent
  // with single-series plots.
  const chromeKey: SeriesKey = groups[0]?.paletteKey ?? 'teal'
  const chromeTheme = series[chromeKey]
  const bands = (result.annotations ?? []).filter(
    (a): a is { type: 'band'; from: number; to: number; axis?: 'x' | 'y' } => a.type === 'band'
  )
  const hlines = (result.annotations ?? []).filter(
    (a): a is { type: 'hline'; y: number; label?: string } => a.type === 'hline'
  )
  const vlines = (result.annotations ?? []).filter(
    (a): a is { type: 'vline'; x: number; label?: string } => a.type === 'vline'
  )

  // Compute a consistent ordered list of unique x positions for bar plots so
  // grouped/dodged bars line up cleanly. We use the union across series.
  const uniqueXs = useMemo(() => {
    if (kind !== 'bar') return [] as number[]
    const seen = new Set<number>()
    for (const p of result.points) {
      if (!seen.has(p.x)) seen.add(p.x)
    }
    return Array.from(seen).sort((a, b) => a - b)
  }, [kind, result.points])

  const isMulti = groups.length > 1

  return (
    <Group left={margin.left} top={margin.top}>
      {/* grid lines */}
      {yScale.ticks(5).map((t) => (
        <line
          key={`g-${t}`}
          x1={0}
          x2={inner.width}
          y1={yScale(t)}
          y2={yScale(t)}
          stroke={plotChrome.grid}
          strokeDasharray="3 3"
        />
      ))}

      {/* bands (use the first series' hatch for consistency) */}
      {bands.map((b, i) => {
        const x1 = xScale(Math.min(b.from, b.to))
        const x2 = xScale(Math.max(b.from, b.to))
        return (
          <rect
            key={`b-${i}`}
            x={x1}
            y={0}
            width={Math.max(0, x2 - x1)}
            height={inner.height}
            fill={`url(#${textureIds.hatch(chromeKey)})`}
            opacity={0.75}
          />
        )
      })}

      {/* main series — render per-series */}
      {kind === 'area' &&
        groups.map((g) => (
          <AreaClosed
            key={`area-${String(g.name)}`}
            data={g.points}
            x={(d) => xScale(d.x)}
            y={(d) => yScale(d.y)}
            yScale={yScale}
            fill={`url(#${textureIds.gradient(g.paletteKey)})`}
            stroke={series[g.paletteKey].stroke}
            strokeWidth={2}
            opacity={isMulti ? 0.7 : 1}
          />
        ))}

      {kind === 'line' &&
        groups.map((g) => (
          <g key={`line-${String(g.name)}`}>
            {/* Skip the gradient fill for multi-series plots — overlapping
                gradients become muddy. Single-series keeps its area for visual
                weight (matches the legacy behaviour). */}
            {!isMulti && (
              <AreaClosed
                data={g.points}
                x={(d) => xScale(d.x)}
                y={(d) => yScale(d.y)}
                yScale={yScale}
                fill={`url(#${textureIds.gradient(g.paletteKey)})`}
                opacity={0.45}
              />
            )}
            <LinePath
              data={g.points}
              x={(d) => xScale(d.x)}
              y={(d) => yScale(d.y)}
              stroke={series[g.paletteKey].stroke}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

      {kind === 'bar' && (
        <>
          {(() => {
            // Single-series: full-width bars (legacy behaviour). Multi-series:
            // dodge bars at each unique x position by group index.
            const slots = Math.max(1, uniqueXs.length)
            const baseSlotW = inner.width / slots
            if (!isMulti) {
              return groups[0]?.points.map((p, i) => {
                const bw = Math.max(1, baseSlotW - 1)
                const x = xScale(p.x) - bw / 2
                return (
                  <Bar
                    key={`bar-${i}`}
                    x={x}
                    y={yScale(p.y)}
                    width={bw}
                    height={Math.max(0, inner.height - yScale(p.y))}
                    fill={`url(#${textureIds.gradient(chromeKey)})`}
                    stroke={series[chromeKey].stroke}
                    strokeWidth={1}
                  />
                )
              })
            }
            const groupCount = groups.length
            const slotW = Math.max(1, baseSlotW * 0.9)
            const dodgeW = slotW / groupCount
            return groups.map((g, gi) =>
              g.points.map((p, i) => {
                const slotCenter = xScale(p.x)
                const x = slotCenter - slotW / 2 + gi * dodgeW
                return (
                  <Bar
                    key={`bar-${gi}-${i}`}
                    x={x}
                    y={yScale(p.y)}
                    width={Math.max(0.5, dodgeW - 0.5)}
                    height={Math.max(0, inner.height - yScale(p.y))}
                    fill={`url(#${textureIds.gradient(g.paletteKey)})`}
                    stroke={series[g.paletteKey].stroke}
                    strokeWidth={1}
                  />
                )
              })
            )
          })()}
        </>
      )}

      {/* hlines */}
      {hlines.map((h, i) => (
        <g key={`h-${i}`}>
          <line
            x1={0}
            x2={inner.width}
            y1={yScale(h.y)}
            y2={yScale(h.y)}
            stroke={chromeTheme.stroke}
            strokeWidth={1.25}
            strokeDasharray="4 4"
            opacity={0.9}
          />
          {h.label && (
            <text
              x={inner.width - 6}
              y={yScale(h.y) - 4}
              textAnchor="end"
              fontSize={10}
              fill={chromeTheme.text}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {h.label}
            </text>
          )}
        </g>
      ))}

      {/* vlines */}
      {vlines.map((v, i) => {
        // Stagger label y-positions so closely-spaced vlines don't overlap.
        // Three rows, then wrap. Labels also flip to right-anchored when the
        // vline is in the right third of the plot, to avoid bleed-off.
        const labelY = 10 + (i % 3) * 14
        const px = xScale(v.x)
        const rightSide = px > inner.width * 0.65
        return (
          <g key={`v-${i}`}>
            <line
              x1={px}
              x2={px}
              y1={0}
              y2={inner.height}
              stroke={chromeTheme.stroke}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {v.label && (
              <text
                x={rightSide ? px - 4 : px + 4}
                y={labelY}
                textAnchor={rightSide ? 'end' : 'start'}
                fontSize={10}
                fill={chromeTheme.text}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {v.label}
              </text>
            )}
          </g>
        )
      })}

      {/* axes */}
      <AxisLeft
        scale={yScale}
        numTicks={5}
        stroke={plotChrome.axis}
        tickStroke={plotChrome.axis}
        tickLabelProps={() => ({
          fill: plotChrome.axisLabel,
          fontSize: 10,
          textAnchor: 'end',
          dx: '-0.25em',
          dy: '0.25em',
        })}
        label={yLabel}
        labelOffset={36}
        labelProps={{
          fill: plotChrome.axisLabel,
          fontSize: 11,
          textAnchor: 'middle',
        }}
      />
      <AxisBottom
        top={inner.height}
        scale={xScale}
        numTicks={6}
        stroke={plotChrome.axis}
        tickStroke={plotChrome.axis}
        tickLabelProps={() => ({
          fill: plotChrome.axisLabel,
          fontSize: 10,
          textAnchor: 'middle',
        })}
        label={xLabel}
        labelProps={{
          fill: plotChrome.axisLabel,
          fontSize: 11,
          textAnchor: 'middle',
        }}
      />
    </Group>
  )
}

// Avoid an unused-symbol warning if seriesAt is no longer referenced.
void seriesAt

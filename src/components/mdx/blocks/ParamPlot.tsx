import { useMemo, useState } from 'react'
import { scaleLinear } from '@visx/scale'
import { Group } from '@visx/group'
import { LinePath, AreaClosed, Bar } from '@visx/shape'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { ParamPlotProps } from '@/schemas/blocks'
import type { ComputeParams, ComputeResult } from '../compute'
import { getCompute } from '../compute'
import { Plot, type PlotDims } from '../primitives/Plot'
import { Slider } from '../primitives/Slider'
import { Range } from '../primitives/Range'
import { ParamPlayground } from '../primitives/ParamPlayground'
import { plotChrome, series, seriesAt, textureIds } from '../theme/tokens'

type FormatKind = 'int' | 'decimal' | 'percent' | undefined

function formatter(kind: FormatKind) {
  if (kind === 'int') return (v: number) => Math.round(v).toString()
  if (kind === 'percent') return (v: number) => `${Math.round(v * 100)}%`
  if (kind === 'decimal') return (v: number) => v.toFixed(2)
  return (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(2))
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

  if (!compute) {
    return (
      <div className="not-prose my-4 rounded-md border-2 border-destructive/70 bg-destructive/5 px-4 py-3 text-sm">
        <strong className="block font-semibold">ParamPlot error</strong>
        Unknown compute key <code className="font-mono">{props.compute}</code>. Register it in{' '}
        <code className="font-mono">src/components/mdx/compute/index.ts</code>.
      </div>
    )
  }

  const xDomain = result.xDomain ?? extent(result.points.map((p) => p.x))
  const yDomain = result.yDomain ?? extent(result.points.map((p) => p.y))

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
      <Plot
        ariaLabel={props.title ?? props.compute}
        caption={props.caption}
        height={props.height ?? 320}
      >
        {(dims) => (
          <PlotBody
            dims={dims}
            result={result}
            xDomain={xDomain}
            yDomain={yDomain}
            kind={props.kind}
            xLabel={props.xLabel}
            yLabel={props.yLabel}
          />
        )}
      </Plot>
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
  xDomain,
  yDomain,
  kind,
  xLabel,
  yLabel,
}: {
  dims: PlotDims
  result: ComputeResult
  xDomain: [number, number]
  yDomain: [number, number]
  kind: 'line' | 'area' | 'bar'
  xLabel?: string
  yLabel?: string
}) {
  const { inner, margin } = dims
  const xScale = scaleLinear({ domain: xDomain, range: [0, inner.width] })
  const yScale = scaleLinear({ domain: yDomain, range: [inner.height, 0], nice: true })
  const theme = seriesAt(0)
  const seriesKey = 'teal' as const
  const gradientId = textureIds.gradient(seriesKey)
  const bands = (result.annotations ?? []).filter(
    (a): a is { type: 'band'; from: number; to: number; axis?: 'x' | 'y' } => a.type === 'band'
  )
  const hlines = (result.annotations ?? []).filter(
    (a): a is { type: 'hline'; y: number; label?: string } => a.type === 'hline'
  )
  const vlines = (result.annotations ?? []).filter(
    (a): a is { type: 'vline'; x: number; label?: string } => a.type === 'vline'
  )

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

      {/* bands */}
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
            fill={`url(#${textureIds.hatch(seriesKey)})`}
            opacity={0.75}
          />
        )
      })}

      {/* main series */}
      {kind === 'area' && (
        <AreaClosed
          data={result.points}
          x={(d) => xScale(d.x)}
          y={(d) => yScale(d.y)}
          yScale={yScale}
          fill={`url(#${gradientId})`}
          stroke={series[seriesKey].stroke}
          strokeWidth={2}
        />
      )}
      {kind === 'line' && (
        <>
          <AreaClosed
            data={result.points}
            x={(d) => xScale(d.x)}
            y={(d) => yScale(d.y)}
            yScale={yScale}
            fill={`url(#${gradientId})`}
            opacity={0.45}
          />
          <LinePath
            data={result.points}
            x={(d) => xScale(d.x)}
            y={(d) => yScale(d.y)}
            stroke={series[seriesKey].stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === 'bar' &&
        result.points.map((p, i) => {
          const bw = Math.max(1, inner.width / Math.max(1, result.points.length) - 1)
          return (
            <Bar
              key={i}
              x={xScale(p.x) - bw / 2}
              y={yScale(p.y)}
              width={bw}
              height={Math.max(0, inner.height - yScale(p.y))}
              fill={`url(#${gradientId})`}
              stroke={series[seriesKey].stroke}
              strokeWidth={1}
            />
          )
        })}

      {/* hlines */}
      {hlines.map((h, i) => (
        <g key={`h-${i}`}>
          <line
            x1={0}
            x2={inner.width}
            y1={yScale(h.y)}
            y2={yScale(h.y)}
            stroke={theme.stroke}
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
              fill={theme.text}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {h.label}
            </text>
          )}
        </g>
      ))}

      {/* vlines */}
      {vlines.map((v, i) => (
        <line
          key={`v-${i}`}
          x1={xScale(v.x)}
          x2={xScale(v.x)}
          y1={0}
          y2={inner.height}
          stroke={theme.stroke}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}

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

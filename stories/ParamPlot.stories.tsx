import { ParamPlot } from '../src/components/mdx/blocks/ParamPlot'

export default {
  title: 'Blocks / ParamPlot',
}

export const GptqFlippingRange = () => (
  <ParamPlot
    compute="gptq.flippingRange"
    title="GPTQ flipping range"
    caption="Teal curve + hatched band where p_flip ≥ threshold."
    kind="line"
    xLabel="weight"
    yLabel="flip probability"
    params={{ bits: 3, sigma: 0.25, threshold: 0.3, range: 3 }}
    controls={[
      {
        kind: 'slider',
        param: 'sigma',
        label: 'Noise σ',
        min: 0.02,
        max: 0.8,
        step: 0.01,
        format: 'decimal',
      },
      {
        kind: 'slider',
        param: 'threshold',
        label: 'Threshold τ',
        min: 0.05,
        max: 0.95,
        step: 0.05,
        format: 'percent',
      },
    ]}
  />
)

export const ServingLatencyTail = () => (
  <ParamPlot
    compute="serving.latencyTail"
    title="M/M/1 tail latency"
    caption="Survival curve; SLA vline, p99 band."
    kind="area"
    xLabel="latency (ms)"
    yLabel="P(T > t)"
    params={{ qps: 120, serviceMs: 6, slaMs: 50, rangeMs: 200 }}
    controls={[
      {
        kind: 'slider',
        param: 'qps',
        label: 'Arrival rate (qps)',
        min: 10,
        max: 200,
        step: 5,
        format: 'int',
      },
      {
        kind: 'slider',
        param: 'serviceMs',
        label: 'Service time (ms)',
        min: 1,
        max: 20,
        step: 0.5,
        format: 'decimal',
      },
    ]}
  />
)

export const UnknownComputeKey = () => (
  <ParamPlot compute="does.not.exist" title="Broken" params={{}} controls={[]} />
)

import { z } from 'zod'

export const FigureProps = z
  .object({
    src: z.string().min(1),
    alt: z.string().min(1),
    caption: z.string().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .strict()
export type FigureProps = z.infer<typeof FigureProps>

export const CalloutProps = z
  .object({
    tone: z.enum(['info', 'warn', 'insight', 'aside']).default('info'),
    title: z.string().optional(),
  })
  .strict()
export type CalloutProps = z.infer<typeof CalloutProps>

// ParamPlot is the generic "run a compute function + plot the output" block.
// `compute` is a string key into the compute registry (compute/index.ts).
// `params` is the literal param object passed to the compute function.
// `kind` selects the visual style (line, area, bar).
export const ParamPlotProps = z
  .object({
    compute: z.string().min(1),
    params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
    controls: z
      .array(
        z.discriminatedUnion('kind', [
          z
            .object({
              kind: z.literal('slider'),
              param: z.string().min(1),
              label: z.string().min(1),
              min: z.number(),
              max: z.number(),
              step: z.number().positive(),
              hint: z.string().optional(),
              format: z.enum(['int', 'decimal', 'percent']).optional(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('range'),
              param: z.string().min(1),
              label: z.string().min(1),
              min: z.number(),
              max: z.number(),
              step: z.number().positive(),
              hint: z.string().optional(),
              format: z.enum(['int', 'decimal', 'percent']).optional(),
            })
            .strict(),
        ])
      )
      .default([]),
    title: z.string().optional(),
    caption: z.string().optional(),
    height: z.number().positive().optional(),
    kind: z.enum(['line', 'area', 'bar']).default('line'),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
  })
  .strict()
export type ParamPlotProps = z.infer<typeof ParamPlotProps>

// Validator-side name → schema map. Kept free of React imports so the
// validator script can load it in Node without pulling the component tree.
export const blockSchemas = {
  Figure: FigureProps,
  Callout: CalloutProps,
  ParamPlot: ParamPlotProps,
} as const

export type BlockName = keyof typeof blockSchemas
export const blockNames = Object.keys(blockSchemas) as BlockName[]

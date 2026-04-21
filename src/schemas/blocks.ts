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

// Quiz — self-contained multiple-choice question. Supports single-select
// (exactly one correct choice) or multi-select (one or more correct).
// Schema enforces that at least one choice is marked correct; single-select
// requires exactly one.
export const QuizProps = z
  .object({
    question: z.string().min(1),
    choices: z
      .array(
        z
          .object({
            text: z.string().min(1),
            correct: z.boolean().default(false),
          })
          .strict()
      )
      .min(2)
      .max(8),
    explanation: z.string().optional(),
    multiSelect: z.boolean().default(false),
  })
  .strict()
  .refine((q) => q.choices.some((c) => c.correct), {
    message: 'at least one choice must be marked correct',
    path: ['choices'],
  })
  .refine((q) => q.multiSelect || q.choices.filter((c) => c.correct).length === 1, {
    message: 'single-select quiz must have exactly one correct choice',
    path: ['choices'],
  })
export type QuizProps = z.infer<typeof QuizProps>

// LoopedSVG — curated set of self-contained animated SVG loops. Each preset
// is an opinionated little explainer graphic; posts just pick one by name and
// optionally override duration.
export const LoopedSVGProps = z
  .object({
    preset: z.enum(['pulse', 'wave', 'orbit', 'scan']),
    duration: z.number().positive().max(30).default(3),
    title: z.string().optional(),
    caption: z.string().optional(),
    height: z.number().positive().max(600).optional(),
    paused: z.boolean().default(false),
  })
  .strict()
export type LoopedSVGProps = z.infer<typeof LoopedSVGProps>

// Validator-side name → schema map. Kept free of React imports so the
// validator script can load it in Node without pulling the component tree.
export const blockSchemas = {
  Figure: FigureProps,
  Callout: CalloutProps,
  ParamPlot: ParamPlotProps,
  Quiz: QuizProps,
  LoopedSVG: LoopedSVGProps,
} as const

export type BlockName = keyof typeof blockSchemas
export const blockNames = Object.keys(blockSchemas) as BlockName[]

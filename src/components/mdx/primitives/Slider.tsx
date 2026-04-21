import * as RadixSlider from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format?: (v: number) => string
  hint?: string
  className?: string
}

export function Slider({ label, min, max, step, value, onChange, format, hint, className }: Props) {
  const display = format ? format(value) : String(value)
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        <span className="text-sm font-mono tabular-nums text-foreground">{display}</span>
      </div>
      <RadixSlider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      >
        <RadixSlider.Track className="relative h-2 w-full grow overflow-hidden rounded-full border border-foreground/60 bg-muted">
          <RadixSlider.Range className="absolute h-full bg-foreground/80" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          className="block h-4 w-4 rounded-full border-2 border-foreground bg-background shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={label}
        />
      </RadixSlider.Root>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

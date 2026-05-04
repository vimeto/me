type Props = {
  number: string
  title: string
  note?: string
}

export function SectionHeader({ number, title, note }: Props) {
  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="flex items-baseline gap-3 md:gap-4">
          <span className="font-mono text-xs text-ink tabular-nums tracking-tight">{number}</span>
          <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">
            /
          </span>
          <span className="text-2xl font-bold tracking-tight">{title}</span>
        </h2>
        {note && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {note}
          </span>
        )}
      </div>
      <div className="mt-4 h-px bg-border" aria-hidden="true" />
    </div>
  )
}

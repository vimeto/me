import type { ReactNode } from 'react'

type Props = {
  title?: string
  controls: ReactNode
  children: ReactNode
}

export function ParamPlayground({ title, controls, children }: Props) {
  return (
    <section className="not-prose my-8 rounded-lg border-2 border-foreground/80 bg-card">
      {title && (
        <header className="border-b-2 border-foreground/80 bg-muted/50 px-4 py-2">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </header>
      )}
      <div className="grid gap-6 p-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 order-2 md:order-1">{children}</div>
        <div className="order-1 flex flex-col gap-5 md:order-2 md:border-l-2 md:border-foreground/20 md:pl-4">
          {controls}
        </div>
      </div>
    </section>
  )
}

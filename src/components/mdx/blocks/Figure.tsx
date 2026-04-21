import { FigureProps } from '@/schemas/blocks'

export function Figure(rawProps: unknown) {
  const props = FigureProps.parse(rawProps)
  return (
    <figure className="not-prose my-6">
      <div className="rounded-md border-2 border-foreground/80 bg-card p-2">
        <img
          src={props.src}
          alt={props.alt}
          width={props.width}
          height={props.height}
          loading="lazy"
          className="block w-full h-auto rounded-sm"
        />
      </div>
      {props.caption && (
        <figcaption className="mt-2 text-xs text-muted-foreground">{props.caption}</figcaption>
      )}
    </figure>
  )
}

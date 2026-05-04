// Placeholder figure — edge/cloud cognitive core. Swap with a real diagram later.
// Pure currentColor + theme tokens so it inverts cleanly in dark mode.
export function ArchitectureDiagram() {
  return (
    <figure className="my-10">
      <svg
        viewBox="0 0 640 220"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto text-foreground"
        role="img"
        aria-labelledby="arch-title arch-desc"
      >
        <title id="arch-title">Edge / cloud architecture for a cognitive core</title>
        <desc id="arch-desc">
          A small, tool-using model with adapters runs on the device. A frozen backbone runs in the
          cloud. The two exchange rollouts and weight updates.
        </desc>

        <g fill="none" stroke="currentColor" strokeWidth={1}>
          <rect x="20" y="30" width="240" height="150" />
          <rect x="380" y="30" width="240" height="150" />
          <line x1="260" y1="80" x2="372" y2="80" />
          <line x1="380" y1="130" x2="268" y2="130" />
        </g>

        <g fill="currentColor" stroke="none">
          <polygon points="380,80 370,76 370,84" />
          <polygon points="260,130 270,126 270,134" />
        </g>

        <g
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontSize="10"
          letterSpacing="0.18em"
          fill="currentColor"
        >
          <text x="36" y="56">
            <tspan style={{ fill: 'rgb(var(--ink))' }} fontWeight="700">
              01
            </tspan>
            <tspan>{'  EDGE'}</tspan>
          </text>
          <text x="396" y="56">
            <tspan style={{ fill: 'rgb(var(--ink))' }} fontWeight="700">
              02
            </tspan>
            <tspan>{'  CLOUD'}</tspan>
          </text>
        </g>

        <g
          fontFamily="Newsreader, ui-serif, Georgia, serif"
          fontSize="22"
          fontWeight="500"
          fill="currentColor"
        >
          <text x="36" y="92">
            Cognitive core
          </text>
          <text x="396" y="92">
            Backbone
          </text>
        </g>

        <g fontFamily="Inter, system-ui, sans-serif" fontSize="12" fill="currentColor">
          <text x="36" y="118">
            Small model + adapters
          </text>
          <text x="36" y="138">
            Tools, retrieval
          </text>
          <text x="36" y="158">
            On-device rollouts
          </text>
          <text x="396" y="118">
            Frozen weights
          </text>
          <text x="396" y="138">
            Off-policy updates
          </text>
          <text x="396" y="158">
            Inference at scale
          </text>
        </g>

        <g
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontSize="10"
          letterSpacing="0.18em"
          fill="currentColor"
          textAnchor="middle"
        >
          <text x="320" y="74">
            ROLLOUTS
          </text>
          <text x="320" y="148">
            WEIGHT UPDATES
          </text>
        </g>
      </svg>
      <figcaption className="mt-4 text-xs font-mono uppercase tracking-wider text-muted-foreground text-center">
        Fig. 1 — Edge / cloud collaboration
      </figcaption>
    </figure>
  )
}

import { Callout } from '../src/components/mdx/blocks/Callout'

export default {
  title: 'Blocks / Callout',
}

export const Info = () => (
  <Callout tone="info" title="Heads up">
    <p>Informational callouts use the teal palette.</p>
  </Callout>
)

export const Warn = () => (
  <Callout tone="warn" title="Caution">
    <p>Warnings use amber.</p>
  </Callout>
)

export const Insight = () => (
  <Callout tone="insight" title="Insight">
    <p>Insights use violet.</p>
  </Callout>
)

export const Aside = () => (
  <Callout tone="aside">
    <p>An aside without a title, using the lime palette.</p>
  </Callout>
)

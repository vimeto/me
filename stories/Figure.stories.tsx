import { Figure } from '../src/components/mdx/blocks/Figure'

export default {
  title: 'Blocks / Figure',
}

export const Basic = () => (
  <Figure
    src="https://placehold.co/640x360?text=cover"
    alt="placeholder cover image"
    caption="A figure with caption."
  />
)

export const NoCaption = () => (
  <Figure src="https://placehold.co/640x360?text=raw" alt="raw image" />
)

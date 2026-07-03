/// <reference types="vite/client" />

declare module 'virtual:post-features' {
  import type { PostFeatures } from '@/lib/content/postFeatures'
  const features: Record<string, PostFeatures>
  export default features
}

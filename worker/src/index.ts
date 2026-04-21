import { createApp } from './app'

// The public API surface for vilhelmtoivonen.com. Lives on a Cloudflare
// Worker and is proxied in front of the static SSG site. Tests import
// `createApp` from `./app` directly so they can inject stub deps.
export default createApp()

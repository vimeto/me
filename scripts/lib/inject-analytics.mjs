// Small pure helper: inject the Cloudflare Web Analytics beacon into an HTML
// template string. Lives in its own module so tests can exercise it without
// re-running the whole prerender pipeline (which reads and rewrites the same
// file and is therefore not idempotent).

/**
 * @param {string} html - full HTML template (`<!doctype html>…</html>`)
 * @param {string | undefined} token - Cloudflare Web Analytics beacon token
 * @returns {string} HTML with a `<script>` beacon inserted before `</head>`
 *   when the token is truthy; otherwise the input unchanged.
 */
export function injectCloudflareBeacon(html, token) {
  if (!token) return html
  const snippet =
    `    <!-- Cloudflare Web Analytics -->\n` +
    `    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" ` +
    `data-cf-beacon='${JSON.stringify({ token })}'></script>\n`
  return html.replace('</head>', `${snippet}  </head>`)
}

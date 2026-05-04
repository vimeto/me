# Deploy notes

State of the production deployment as of 2026-05-04.

## What's live

- **Cloudflare D1**: `personal-page` (id `8533456f-2ed4-4226-9254-a3ce575b05dc`, region EEUR). Migration `0001_init.sql` applied.
- **Cloudflare Worker**: `personal-page-worker`, deployed.
- **Worker route**: `vtoivonen.com/api/*` → `personal-page-worker`.
- **Direct URL**: also reachable at `https://personal-page-worker.vilhelm-toivonen.workers.dev` (currently returning 1042 from the edge — non-blocker, the custom-domain route is the path the site uses).

Verified end-to-end:

```
GET  https://vtoivonen.com/api/comments?post=hello-world  → 200 {"post":"hello-world","count":0,"comments":[]}
POST https://vtoivonen.com/api/comments                   → 200 {"status":"pending","id":N}
OPTIONS preflight                                          → 204 with access-control-allow-origin: https://vtoivonen.com
```

So the comments backend is working; submitted comments land in D1 with `status:"pending"`.

## What's still missing for the comments form to work from a real visitor

### 1. Static site has to be served at `vtoivonen.com`

Right now the worker is bound to `vtoivonen.com/api/*` but nothing is serving anything else on that domain. The intro post's "Comments are open" line points to a form that calls same-origin `/api/comments` — that only works if the static site is served at `vtoivonen.com`.

Options:

- **Cloudflare Pages**: connect this repo, set build command to `pnpm build`, output dir to `dist`, set custom domain to `vtoivonen.com`. The worker route will continue to intercept `/api/*` underneath.
- **Anywhere else** (Vercel / Netlify / GitHub Pages) with a CNAME to `vtoivonen.com` works too, as long as the worker route still wins for `/api/*` (it does — Cloudflare Workers routes intercept at the edge, before any origin).

### 2. Worker secrets (optional but recommended)

The worker is currently deployed without these. It tolerates their absence and routes every comment to `pending`, but auto-moderation and spam protection are off until you add them:

```bash
set -a; source ./.env.local; set +a
pnpm exec wrangler secret put OPENAI_API_KEY   --config worker/wrangler.toml   # OpenAI API key (gpt-5.4-nano moderation)
pnpm exec wrangler secret put TURNSTILE_SECRET --config worker/wrangler.toml   # Cloudflare Turnstile server secret
```

### 3. Cloudflare Turnstile sitekey for the frontend

Create a Turnstile widget at <https://dash.cloudflare.com/?to=/:account/turnstile> (or via the Turnstile API once the token has `Turnstile Sites:Edit`). Copy the **sitekey** (public) and the **secret** (the one you put into the worker as `TURNSTILE_SECRET`).

The static site reads the sitekey from `VITE_TURNSTILE_SITEKEY` at build time. Set it as a Cloudflare Pages env var (or `.env.production` if you're building locally) and rebuild.

### 4. Cloudflare Access for the admin moderation panel (optional, future)

`/admin` is gated behind Cloudflare Access. To use it you'd set:

- `ACCESS_TEAM_DOMAIN` (your `<slug>.cloudflareaccess.com` slug)
- `ACCESS_AUD` (Application Audience tag from the Access app)

…via `wrangler secret put` and create an Access Application protecting `vtoivonen.com/admin`. Not required for posting comments; only required when you want to moderate them through the web UI.

## Token permissions

Current API token (in `.env.local`) has at least:

- Account: D1:Edit, Workers Scripts:Edit
- Zone: Workers Routes:Edit (on `vtoivonen.com`)

It is **missing** these, which would let me do more from the CLI:

- Account: Pages:Edit (to deploy the static site to Cloudflare Pages from CLI)
- Zone: DNS:Edit (to wire DNS records for the custom domain, if not already set)
- Account: Turnstile Sites:Edit (to provision the Turnstile widget)

If you want me to take any of those steps directly, regenerate the token with those scopes added and replace the value in `.env.local`.

## Commands cheat sheet

```bash
# Always source first:
set -a; source ./.env.local; set +a

# Worker
pnpm exec wrangler deploy --config worker/wrangler.toml
pnpm exec wrangler tail   --config worker/wrangler.toml      # live logs

# D1
pnpm exec wrangler d1 execute personal-page --config worker/wrangler.toml --remote --command "SELECT id, post_slug, author_name, status FROM comments;"
pnpm exec wrangler d1 migrations apply personal-page --config worker/wrangler.toml --remote

# Secrets
pnpm exec wrangler secret list --config worker/wrangler.toml
pnpm exec wrangler secret put OPENAI_API_KEY --config worker/wrangler.toml
```

# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
(next) a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

Working on it with an agent: start at [AGENTS.md](AGENTS.md).

## Review preview

Capture the self-contained HTML for the sample night with:

```sh
pnpm preview:capture -- /tmp/rig-preview/index.html
```

The destination must be outside this repository. The command renders the Hono route directly;
the page includes its layout and stylesheet and has no client JavaScript. The manual-only
workflow in `.github/workflows/preview-pages.yml` builds the same file into a GitHub Pages
artifact. Its `lane_marker` input is optional: pass the marker for the review copy, then leave it
blank when replacing that page after review. The preview itself is never committed to this repo.

# Dragonfly Real-time data

Standalone big-screen dashboard (1920×1080 stage, letterbox-scaled to any screen; stacked layout on phones).
Live site: https://x1012619000-tech.github.io/dragonfly-realtime/

- `docs/` — static site served by GitHub Pages (three.js + fonts + world map vendored locally, no CDN)
  - `js/config.js` — set the API endpoint here · `js/seed.js` — seed snapshot · `js/i18n.js` — EN / 中文 strings
- `worker/` — Cloudflare Worker data API (`/api/snapshot`, `/api/ingest`) — see `worker/README.md`
- `API.md` — field-by-field data spec (EN + 中文)

Credits: three.js (MIT); Earth texture derived (greyscale) from NASA Blue Marble imagery (public domain, via three-globe examples); world-atlas / Natural Earth (public domain); Chakra Petch, Rajdhani, Share Tech Mono (SIL OFL); DSEG7 by keshikan (SIL OFL, see docs/fonts/DSEG-LICENSE.txt).

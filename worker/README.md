# Dragonfly Real-time data — Cloudflare Worker (not deployed yet / 尚未部署)

Serves `GET /api/snapshot` (CORS), `POST /api/ingest` (Bearer token), `GET /api/health`. Schema: see `../API.md`.

## What you need / 需要准备
1. A Cloudflare account (free plan is enough). 一个 Cloudflare 账号（免费版即可）
2. Either log in interactively (`npx wrangler login`) **or** create an API token: Dashboard → My Profile → API Tokens → *Edit Cloudflare Workers* template, and export `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
   交互登录，或创建「Edit Cloudflare Workers」模板的 API Token。

## Deploy / 部署
```bash
cd worker
npm install
npx wrangler login                      # or export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
npx wrangler kv namespace create DFLY_KV   # optional, paste id into wrangler.toml and uncomment the block
npx wrangler secret put INGEST_TOKEN     # any long random string; used by systems that push data
npm run deploy                           # → https://dragonfly-realtime-api.<subdomain>.workers.dev
```
Then set `api` in `docs/js/config.js` to `https://dragonfly-realtime-api.<subdomain>.workers.dev/api/snapshot`, commit & push — the header switches from **SIMULATED** to **LIVE**.
（也可以不改代码，直接访问 `…/?api=<worker地址>/api/snapshot` 测试）

## Connect real data / 接入真实数据
- **Pull**: set `UPSTREAM_URLS` in `wrangler.toml` `[vars]` (JSON map), optional secret `UPSTREAM_AUTH` (sent as `Authorization`).
- **Push**: your backend calls `POST /api/ingest` with `Authorization: Bearer <INGEST_TOKEN>`.
- Production: set `ALLOW_ORIGIN = "https://x1012619000-tech.github.io"`.

## Local test / 本地测试
```bash
npx wrangler dev        # http://localhost:8787/api/snapshot
```
`npm run seed` regenerates `src/seed.js` from `../docs/js/seed.js` (single source of seed data).

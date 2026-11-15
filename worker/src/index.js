/**
 * Dragonfly Real-time data — Cloudflare Worker data API
 *
 *   GET  /api/snapshot   unified JSON snapshot for all dashboard zones (CORS enabled)
 *   POST /api/ingest     push data from another system (Authorization: Bearer <INGEST_TOKEN>)
 *   GET  /api/health     liveness
 *
 * Snapshot = seed  ⟵ merged with ⟵  ingested data (KV)  ⟵ merged with ⟵  upstream APIs (UPSTREAM_URLS)
 *
 * Env / bindings (see wrangler.toml & README):
 *   INGEST_TOKEN    secret  — required for POST /api/ingest
 *   UPSTREAM_URLS   var     — JSON: {"*":"https://a/full.json","liquidity":"https://b/liq","feed":"https://c/feed"}
 *   UPSTREAM_AUTH   secret  — optional value sent as Authorization header to upstreams
 *   CACHE_TTL       var     — seconds to cache upstream responses (default 10)
 *   ALLOW_ORIGIN    var     — CORS origin (default "*")
 *   DFLY_KV         KV      — optional; persists ingested data across isolates
 */
import SEED from "./seed.js";

const MAX_ROWS = 50;
let memIngest = null;                 // fallback store when no KV is bound (per-isolate, not durable)
const memUpstream = { at: 0, data: null };

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function deepMerge(a, b) {
  if (!isObj(a) || !isObj(b)) return b === undefined ? a : b;
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = isObj(a[k]) && isObj(b[k]) ? deepMerge(a[k], b[k]) : b[k];
  return out;
}

function cors(env, extra = {}) {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}
const json = (env, body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: cors(env, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }) });

async function loadIngest(env) {
  if (env.DFLY_KV) { const v = await env.DFLY_KV.get("ingest", "json"); return v || {}; }
  return memIngest || {};
}
async function saveIngest(env, data) {
  if (env.DFLY_KV) await env.DFLY_KV.put("ingest", JSON.stringify(data));
  else memIngest = data;
}

async function loadUpstream(env) {
  let map;
  try { map = env.UPSTREAM_URLS ? JSON.parse(env.UPSTREAM_URLS) : null; } catch { map = null; }
  if (!map || !Object.keys(map).length) return { data: {}, errors: [] };
  const ttl = (+env.CACHE_TTL || 10) * 1000;
  if (memUpstream.data && Date.now() - memUpstream.at < ttl) return memUpstream.data;
  const headers = { Accept: "application/json" };
  if (env.UPSTREAM_AUTH) headers.Authorization = env.UPSTREAM_AUTH;
  const errors = [];
  let data = {};
  await Promise.all(Object.entries(map).map(async ([key, url]) => {
    try {
      const r = await fetch(url, { headers, cf: { cacheTtl: +env.CACHE_TTL || 10, cacheEverything: true } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const body = await r.json();
      data = key === "*" ? deepMerge(data, body) : deepMerge(data, { [key]: body });
    } catch (e) { errors.push({ source: key, error: String(e.message || e) }); }
  }));
  const res = { data, errors };
  memUpstream.at = Date.now(); memUpstream.data = res;
  return res;
}

async function snapshot(env) {
  const ingest = await loadIngest(env);
  const up = await loadUpstream(env);
  let snap = deepMerge(deepMerge(SEED, ingest), up.data);
  snap.meta = { ...snap.meta, generatedAt: new Date().toISOString(), sources: { seed: true, ingest: Object.keys(ingest).length > 0, upstream: Object.keys(up.data).length > 0, upstreamErrors: up.errors } };
  return snap;
}

/* Ingest body:
 *   { ...partial snapshot... }                       deep-merged into stored data
 *   { "append": { "feed": [rows] } } rows are prepended (newest first), trimmed to 50
 *   ?mode=replace                                     replace stored data entirely
 */
async function ingest(req, env) {
  const auth = req.headers.get("Authorization") || "";
  if (!env.INGEST_TOKEN || auth !== "Bearer " + env.INGEST_TOKEN) return json(env, { ok: false, error: "unauthorized" }, 401);
  let body;
  try { body = await req.json(); } catch { return json(env, { ok: false, error: "invalid JSON" }, 400); }
  if (!isObj(body)) return json(env, { ok: false, error: "body must be an object" }, 400);
  const mode = new URL(req.url).searchParams.get("mode");
  let cur = mode === "replace" ? {} : await loadIngest(env);
  const { append, ...rest } = body;
  cur = deepMerge(cur, rest);
  if (isObj(append)) {
    if (Array.isArray(append.feed)) cur.feed = [...append.feed, ...(cur.feed || SEED.feed)].slice(0, MAX_ROWS);
  }
  cur.meta = { ...(cur.meta || {}), ingestedAt: new Date().toISOString() };
  await saveIngest(env, cur);
  return json(env, { ok: true, stored: env.DFLY_KV ? "kv" : "memory", keys: Object.keys(cur) });
}


/* Optional proxies for the Liquidity Proof search and the Daily Commitment "Verify root" button.
   Point the frontend config lookupApi / verifyApi at these routes once LOOKUP_UPSTREAM / VERIFY_UPSTREAM are set.
   Without an upstream they answer 501 so the dashboard shows its "API not connected" state. */
async function proxy(req, env, upstream, allowed) {
  if (!upstream) return json(env, { ok: false, error: "not configured" }, 501);
  const inUrl = new URL(req.url), out = new URL(upstream);
  for (const k of allowed) { const v = inUrl.searchParams.get(k); if (v != null) out.searchParams.set(k, v.slice(0, 200)); }
  const headers = { Accept: "application/json" };
  if (env.UPSTREAM_AUTH) headers.Authorization = env.UPSTREAM_AUTH;
  try {
    const r = await fetch(out.toString(), { headers, cf: { cacheTtl: 0 } });
    const body = await r.text();
    return new Response(body, { status: r.status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(env) } });
  } catch (e) { return json(env, { ok: false, error: "upstream error" }, 502); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (url.pathname === "/api/snapshot" && req.method === "GET") return json(env, await snapshot(env));
    if (url.pathname === "/api/ingest" && req.method === "POST") return ingest(req, env);
    if (url.pathname === "/api/lookup" && req.method === "GET") return proxy(req, env, env.LOOKUP_UPSTREAM, ["q", "type"]);
    if (url.pathname === "/api/verify-root" && req.method === "GET") return proxy(req, env, env.VERIFY_UPSTREAM, ["root", "block"]);
    if (url.pathname === "/api/health") return json(env, { ok: true, kv: !!env.DFLY_KV, time: new Date().toISOString() });
    if (url.pathname === "/" ) return json(env, { name: "dragonfly-realtime-api", endpoints: ["GET /api/snapshot", "POST /api/ingest", "GET /api/lookup", "GET /api/verify-root", "GET /api/health"] });
    return json(env, { ok: false, error: "not found" }, 404);
  },
};

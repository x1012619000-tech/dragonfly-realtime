/* Runtime config. Point `api` at the Cloudflare Worker once deployed, e.g.
 *   api: "https://dragonfly-realtime-api.<your-subdomain>.workers.dev/api/snapshot"
 * Leave empty to run on seed data + simulation (header shows SIMULATED).
 * You can also override per visit with ?api=<url>. */
window.DFLY_CONFIG = window.DFLY_CONFIG || {
  api: "",
  pollMs: 10000,       // how often to pull a fresh snapshot
  simulate: true,      // animate seed data when no live API is reachable
  stream: ""           // optional SSE endpoint (text/event-stream of snapshot JSON) — future
};

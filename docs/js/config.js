/* Runtime config — Dragonfly Real-time data v3.
 * api           : unified snapshot endpoint (Cloudflare Worker GET /api/snapshot). Empty → seed + simulation (SIMULATED).
 * lookupApi     : Liquidity Proof search endpoint. Contract in API.md §Lookup. Empty → "API not connected" state.
 * verifyApi     : Merkle-root verification endpoint. Contract in API.md §Verify root.
 * officialWallet: official settlement wallet address shown in the Daily Settlement Commitment modal.
 * URL overrides: ?api=…&lookup=…&verify=… */
window.DFLY_CONFIG = window.DFLY_CONFIG || {
  api: "",
  pollMs: 10000,
  simulate: true,
  stream: "",
  lookupApi: "",
  verifyApi: "",
  officialWallet: ""
};

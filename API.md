# Dragonfly Real-time data — Data API / 数据接口说明

The dashboard reads **one unified JSON snapshot** and re-renders every zone from it.
大屏只读取 **一个统一的 JSON 快照**，所有面板都由它渲染。

| Item | Value |
|---

Schema version `schema: 3` (v3 layout). Full example = `docs/js/seed.js`. 完整示例见 `docs/js/seed.js`。

## `meta` — header / 顶部
| Field | Type | EN | 中文 |
|---|---|---|---|
| `network`, `chainId` | string, number | e.g. `"BASE Mainnet"`, `8453` | 网络 |
| `block` | number | Latest block, shown top bar `BASE · BLOCK #…` | 最新区块 |
| `explorer` | url | Block explorer base (default `https://basescan.org`) | 区块浏览器 |
| `location`, `timezone` | `{en,zh}`, IANA tz | Clock location / zone (default Asia/Shanghai) | 时钟地点与时区 |

## Zone 1 (top) `supplyChain` — Supply Chain · Live / 供应链 · 实时
| Field | Type | EN | 中文 |
|---|---|---|---|
| `status` | `"running"` \| other | Status pill (RUNNING) | 执行中状态 |
| `kpis.capitalPool` | `{value, share}` | Capital pool $ and share of total (`0.36`) | 资本池金额与占比 |
| `kpis.monthlyProcurement` | `{value, delta}` | Monthly procurement $ and MoM change | 月采购规模及环比 |
| `kpis.turnover` | `{value, delta}` | Turnover ratio (`0.94`) and change | 周转率及变化 |
| `kpis.activeRoutes` | `{value, delta}` | Active routes and change | 活跃航线及变化 |

## Zone 1 (bottom) `feed` — Live Settlement Feed / 即时结算动态
Array, newest first 最新在前: `{from, to, amount, tx, block, ts | ageMin}`. The first row is pinned as **LATEST**; the rest auto-scroll. A new top row pulses its arc on the globe. 第一条置顶高亮，其余自动滚动；新记录会在地球上点亮对应航线。

## Zone 2 — top bar buttons / 顶部功能按钮
### (a) Liquidity Proof — lookup contract / 流动证明查询接口
The search box accepts a **ticket number**, **transaction hash** or **wallet address**; the type is auto-detected: `0x`+64 hex → `tx`, `0x`+40 hex → `wallet`, otherwise `ticket`.
搜索框可输入票号 / 交易哈希 / 钱包地址，自动识别类型。

`GET {lookupApi}?q=<value>&type=<ticket|tx|wallet>` → JSON
```json
{ "ok": true, "type": "ticket",
  "result": { "ticketNo": "781-2345678901", "route": "PVG→ICN", "amount": 132.5, "status": "settled",
              "tx": "0x…64hex", "block": 57645446, "ts": "2026-11-14T08:00:00Z",
              "proof": { "included": true, "root": "0xa7ff…", "leaf": "0x…", "path": ["0x…"] } } }
{ "ok": true, "type": "tx",     "result": { "hash": "0x…", "block": 57645446, "from": "0x…", "to": "0x…", "amount": 132.5, "status": "success", "tickets": ["781-…"] } }
{ "ok": true, "type": "wallet", "result": { "address": "0x…", "balance": 1234.5, "settledCount": 42, "lastTx": "0x…" } }
{ "ok": false, "error": "not found" }
```
No `lookupApi` (or HTTP 501) → polished "Lookup API not connected" state; tx hashes / wallets still get an *Open on Basescan* link.
未配置 `lookupApi`（或返回 501）时显示「查询 API 尚未接入」，交易哈希 / 钱包地址仍可跳转 Basescan。
The Worker exposes `GET /api/lookup` as a proxy to `LOOKUP_UPSTREAM`. Worker 提供 `/api/lookup` 代理。

### (b) Daily Settlement Commitment `commitment` / 每日结算承诺
| Field | Type | EN | 中文 |
|---|---|---|---|
| `root` | 0x…64 hex | Today's Merkle root | 当日默克尔根 |
| `algo` | string | Hash algorithm (`keccak256`) | 哈希算法 |
| `ordersCommitted` | number | Orders committed in today's root | 已提交订单数 |
| `anchorBlock` | number | Block where the root was anchored | 锚定区块 |
| `anchorTx` | 0x…64 hex, optional | Anchoring transaction (else the block page is linked) | 锚定交易（可选） |
| `officialWallet` | 0x…40 hex, optional | Official settlement wallet (overrides `config.officialWallet`); empty → "To be announced" | 官方结算钱包，留空显示「即将公布」 |

**Verify root** → `GET {verifyApi}?root=<0x…>&block=<n>` →
`{ "ok": true, "verified": true, "onchainRoot": "0x…", "block": 57645446, "tx": "0x…", "wallet": "0x…" }`.
No `verifyApi` (or 501) → opens the anchoring block/tx on Basescan. Worker proxy: `GET /api/verify-root` → `VERIFY_UPSTREAM`.
未配置时直接打开 Basescan 上的锚定区块。

### (c) About — static placeholder / 说明（占位）

## Zone 3 `overview` — Overview / 概览
| Field | Type | EN | 中文 |
|---|---|---|---|
| `tvl` | `{value, label}` | TVL $ · "Stable Vault" | TVL · 稳定金库 |
| `burned` | `{total, note, network}` | Cumulative burned · partially confirmed · Base Mainnet | 累计销毁 |
| `activeRoutes` | `{value, delta}` | Active routes | 活跃航线 |
| `lastWeekBurn` | `{value, unit, note}` | Last natural week (UTC) burned, `unit` = `MXP` | 上周销毁（上一自然周 UTC） |
| `apr` | `{value, tier, note}` | Live floating staking APR (`0.12`), Bronze flyer, cent-weighted | 实时浮动质押 APR |

## Zone 4 `liquidity` — bottom-left strip / 左下条
| Field | Type | EN | 中文 |
|---|---|---|---|
| `todayTotal` | number | Today's total settlement (USDC) | 今日总结算 |
| `root` | 0x… | Settlement root shown + *Verify* (opens the commitment modal) | 结算根 |
| `settledTickets` | number | Settled tickets | 已结算票券 |
| `liquidity` | number | Liquidity $ | 流动量 |
| `inFlight` | number | Tickets in flight (not yet settled) | 飞行中 |

## Zone 5 `partners` — partner marquee / 合作伙伴跑马灯
Array `{name, logo, icon?, role:{en,zh}, url}`. Logos are local files in `docs/assets/partners/`, rendered as monochrome silver (CSS filter); `icon` (square) is used instead of `logo` when present. Loops seamlessly, pauses on hover.
本地 Logo，统一银色单色显示；悬停暂停。

## Zone 6 `routes` — Settlement by Route / 按航线结算
Array `{from, to, amount, orders}` (24 h). Bars scale to the max; the list auto-scrolls if it outgrows the panel. Clicking a row flies the globe to that hub.

## Zone 7 `destinations` + `metrics` / 目的地分配 + 网络指标
- `destinations`: `[{key, share}]`, `share` in **percent** (`95.5`); keys with labels: `cn ru kr id us am my vn other`.
- `metrics`: `{cumulative, avgSettleSec, confirmBlocks, settledRoutes, refundRate}` (`refundRate` fraction).

## Globe / 地球
| Field | Type | EN | 中文 |
|---|---|---|---|
| `airports` | `{ IATA: {lat, lon, city:{en,zh}, cc, minor?} }` | Hubs on the big hemisphere + navigator globe; `minor` = dot only | 枢纽坐标与城市名 |
| `hubs` | `{ IATA: {airlines?: string[], todaySettlement?: number} }` | Hub popover extras; otherwise summed from `routes` + `feed` | 枢纽弹窗附加信息 |
| `networkRoutes` | `[[IATA, IATA]]` | Coverage arcs (dashed, no amounts) | 覆盖航线 |

Settlement arcs are derived from `routes` + `feed`. 结算航线由 routes / feed 自动生成。

---

## Pushing data / 推送数据 — `POST /api/ingest`
```bash
curl -X POST https://<worker>/api/ingest \
  -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
  -d '{"liquidity":{"todayTotal":28012.4,"settledTickets":120520},
       "append":{"feed":[{"from":"PVG","to":"ICN","amount":132.5,"tx":"0x…","block":57230001,"ts":1763100000000}]}}'
```
- Body is deep-merged into the stored data (KV). `append.feed` rows are prepended and trimmed to 50. `?mode=replace` replaces everything.
- 请求体与已存数据深度合并；`append` 中的行插入最前并保留 50 条；`?mode=replace` 整体替换。

## Pulling from your systems / 拉取上游 — `UPSTREAM_URLS`
`{"*":"https://api.example.com/dragonfly/snapshot","liquidity":"https://chain-indexer.example.com/liquidity"}` — `"*"` must return (part of) the snapshot; any other key places that response under that key. Cached `CACHE_TTL` s. Order: seed ← ingest ← upstream.
`"*"` 返回整份或部分快照；其他 key 的返回值放入对应字段；缓存 `CACHE_TTL` 秒；优先级：种子 ← 推送 ← 上游。

# Dragonfly Real-time data — Data API / 数据接口说明

The dashboard reads **one unified JSON snapshot** and re-renders every zone from it.
大屏只读取 **一个统一的 JSON 快照**，所有面板都由它渲染。

| Item | Value |
|---|---|
| Endpoint 接口 | `GET /api/snapshot` (Cloudflare Worker, see `worker/`) |
| Frontend config 前端配置 | `docs/js/config.js` → `api: "https://…/api/snapshot"`, `pollMs: 10000` · or URL `?api=…` · or `window.DFLY_API` |
| Polling 轮询 | every `pollMs` ms (default 10 s). Optional SSE: `stream: "https://…/stream"` (each `data:` line = JSON snapshot, full or partial) |
| Fallback 兜底 | no endpoint / fetch error → local seed + simulation, header shows **SIMULATED** / 无接口或请求失败 → 本地种子数据 + 模拟，顶部显示「模拟数据」 |
| Live 实时 | successful fetch → header shows **LIVE · Last sync HH:MM:SS** (updated on every refresh) / 拉取成功显示「实时 · 最近同步」 |
| Partial updates 部分更新 | Every top-level key is optional; missing keys keep their previous value. 所有顶层字段均可省略，缺省保留上次值 |
| CORS | required if you host the API elsewhere; the Worker already sends `Access-Control-Allow-Origin` |

Conventions 约定: amounts are **USD/USDC numbers** (not strings); ratios are **fractions** (`0.417` = 41.7 %) unless noted; airport codes are IATA (must exist in `airports`); rows carry `ts` (epoch ms or ISO string) **or** `ageMin`; `tx` may be a full 0x…64-hex hash (links to `basescan.org/tx/…`) or an abbreviated label (then the block link `basescan.org/block/…` is used).
金额为数字（美元/USDC）；比例为小数（0.417 = 41.7%）；机场代码为 IATA；每行带 `ts`（毫秒时间戳或 ISO）或 `ageMin`；`tx` 为完整哈希时跳转 basescan 交易页，否则跳转区块页。

---

## `meta` — header / 顶部
| Field | Type | EN | 中文 |
|---|---|---|---|
| `network` | string | Chain label, e.g. `BASE Mainnet` | 网络名称 |
| `chainId` | number | 8453 | 链 ID |
| `block` | number | Latest block height (centre readout, zone 2) | 最新区块高度（中间读数、2区） |
| `explorer` | string | Explorer base URL, default `https://basescan.org` | 区块浏览器地址 |
| `location` | `{en,zh}` | Location shown next to the clock | 时钟旁地点 |
| `timezone` | string | IANA zone for the clock, default `Asia/Shanghai` | 时钟时区 |
| `since` | ISO string | *optional* network start → "Network uptime" counter | 可选，网络运行计时起点 |

## Zone 1 `supplyChain` — Supply Chain · Live / 供应链 · 实时
| Field | Type | EN | 中文 |
|---|---|---|---|
| `status` | `"executing"` | Status pill | 状态标签 |
| `kpis.capitalPool` | `{value, share}` | Capital pool USD + share of total (0.36) | 资金池金额 + 占比 |
| `kpis.monthlyProcurement` | `{value, delta}` | Monthly procurement USD + MoM delta | 月采购额 + 环比 |
| `kpis.turnover` | `{value, delta}` | Turnover ratio (0.94) + delta | 周转率 + 变化 |
| `kpis.activeRoutes` | `{value, delta}` | Active routes count + delta | 活跃航线数 + 变化 |
| `flow` | string[] | Flow steps: `usdc, osl, procurement, distribution, recycle` | 资金流步骤 |
| `today` | `{amount, tickets}` | On-chain settlement today | 今日链上结算额、票数 |
| `ticker` | Row[] | Recent settled tickets (auto-scroll) | 最近结算票券（自动滚动） |
| `dailyRoot` | `{hash, block}` | Daily root + block (Verify link) | 每日根哈希 + 区块 |
| `explorerUrl` | string | *optional* "View full settlement explorer" target | 可选，浏览器按钮地址 |

**Row** = `{ from, to, amount, tx, block, ts | ageMin }`  — e.g. `{"from":"PVG","to":"XIY","amount":87,"tx":"0x130b…ca11","block":57216710,"ageMin":3}`

## Zone 2 `liquidity` — Liquidity Proof / 流动性证明
| Field | Type | EN | 中文 |
|---|---|---|---|
| `queryHash` | string | Hash pre-filled in the query box (Query → basescan) | 查询框默认哈希 |
| `lastSettlementMin` | number | Minutes since last settlement | 距上次结算分钟数 |
| `todayTotal` | number | Today's total settlement (USDC) — also centre readout | 今日结算总额（中间读数同） |
| `root` | string | Settlement root label | 结算根 |
| `settledTickets` | number | Cumulative settled tickets | 已结算票数 |
| `liquidity` | number | Available liquidity USD | 流动性 |
| `inFlight` | number | Settlements in flight (tx) | 在途笔数 |

## Zone 3 `feed` — Live Settlement Feed / 实时结算动态
`Row[]`, newest first. `feed[0]` is the highlighted "LATEST" card; the rest auto-scroll. A new `feed[0]` (different `tx`) triggers the slide-in + globe arc flash.
最新在前；`feed[0]` 为高亮卡片，其余自动滚动；新的 `feed[0]` 会触发滑入动画和地球航线闪光。
Optional `featured: true` is informational only.

## Zone 4 `commitment` — Daily Settlement Commitment / 每日结算承诺
| Field | Type | EN | 中文 |
|---|---|---|---|
| `algo` | string | Hash algorithm tag (`keccak256`) | 哈希算法 |
| `root` | string | Full Merkle root (Verify root → basescan) | 默克尔根 |
| `ordersCommitted` | number | Orders committed today | 今日承诺订单数 |
| `anchorBlock` | number | Anchoring block | 锚定区块 |

## Zone 5 `settlementFlow` — USDC Settlement Flow · 24h / USDC 结算流程
| Field | Type | EN | 中文 |
|---|---|---|---|
| `buyer` / `airline` | string | Labels (OTA platform / BSP carrier) | 买方 / 航司标签 |
| `contract` | string | Settlement contract (short) | 结算合约 |
| `fundsIn` | number | Buyer funds the settlement wallet | 资金流入 |
| `netRelease` | number | USDC released after proof passes | 净释放 |
| `reserve` | number | Contract balance held | 储备 |

## Zone 6 `routes` + `metrics` — Settlement by Route · Network Metrics / 按航线结算 · 网络指标
`routes`: `[{ from, to, amount, orders }]` (24h, top 5 shown, bar length ∝ amount / 柱长按金额比例)
| `metrics` field | Type | EN | 中文 |
|---|---|---|---|
| `cumulative` | number | Cumulative settlement USDC | 累计结算 |
| `avgSettleSec` | number | Average settlement time (s) | 平均结算时间 |
| `liveSettleSec` | number | *optional* last settle time → centre "Settle time" readout | 可选，中间读数 |
| `confirmBlocks` | number | Confirmations | 确认区块数 |
| `settledRoutes` | number | Settled routes | 已结算航线 |
| `refundRate` | number | Refund rate (fraction) | 退款率 |

## Zone 7 `destinations` — Destination Breakdown / 目的地分配
`[{ key, share }]` where `share` is a **percentage number** (94.5). Known keys with translations: `cn, ru, id, kr, other, my, vn` (add more keys to `docs/js/i18n.js`).
`share` 为百分数；未知 key 会原样显示，可在 i18n.js 增加翻译。

## Zone 8 — Globe / 3D 地球
| Field | Type | EN | 中文 |
|---|---|---|---|
| `airports` | `{ IATA: {lat, lon, city:{en,zh}, minor?} }` | Hub markers; `minor` hides the label when crowded | 枢纽坐标与中英文城市名 |
| `hubs` | `{ IATA: {airlines?: string[], todaySettlement?: number} }` | Hub popover extras. Without them, today's settlement is summed from `routes` + `feed`, airlines show "Pending API connection" | 枢纽弹窗：航司列表、当日结算额（缺省时自动汇总） |
| `networkRoutes` | `[[IATA, IATA]]` | Global coverage arcs (dashed, no amounts) | 全球覆盖航线（虚线） |

Settlement arcs are derived automatically from `routes`, `feed` and `supplyChain.ticker`. 结算航线由 routes / feed / ticker 自动生成。

---

## Pushing data / 推送数据 — `POST /api/ingest`
```bash
curl -X POST https://<worker>/api/ingest \
  -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
  -d '{"liquidity":{"todayTotal":28012.4,"settledTickets":120520},
       "append":{"feed":[{"from":"PVG","to":"ICN","amount":132.5,"tx":"0x…","block":57230001,"ts":1763100000000}]}}'
```
- Body is deep-merged into the stored data (KV). `append.feed` / `append.ticker` rows are prepended and trimmed to 50. `?mode=replace` replaces everything.
- 请求体与已存数据深度合并；`append` 中的行插入最前并保留 50 条；`?mode=replace` 整体替换。

## Pulling from your systems / 拉取上游 — `UPSTREAM_URLS`
`{"*":"https://api.example.com/dragonfly/snapshot","liquidity":"https://chain-indexer.example.com/liquidity"}` — `"*"` must return (part of) the snapshot; any other key places that response under that key. Cached `CACHE_TTL` s. Order: seed ← ingest ← upstream.
`"*"` 返回整份或部分快照；其他 key 的返回值放入对应字段；缓存 `CACHE_TTL` 秒；优先级：种子 ← 推送 ← 上游。

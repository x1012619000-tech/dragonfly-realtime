/* Dragonfly Real-time data v3 — seed snapshot (same schema as GET /api/snapshot, see API.md). */
(function (root) {
  var SEED = {
    schema: 3,
    meta: {
      network: "BASE Mainnet", chainId: 8453, block: 57645446,
      explorer: "https://basescan.org",
      location: { en: "Shanghai", zh: "上海" }, timezone: "Asia/Shanghai"
    },
    /* zone 1 (top) — Supply Chain · Live */
    supplyChain: {
      status: "running",
      kpis: {
        capitalPool:        { value: 10800000, share: 0.36 },
        monthlyProcurement: { value: 2400000,  delta: 0.402 },
        turnover:           { value: 0.94,     delta: 0.084 },
        activeRoutes:       { value: 1649,     delta: -0.193 }
      }
    },
    /* zone 1 (bottom) — Live Settlement Feed (ticket issuance), newest first */
    feed: [
      { from: "CGK", to: "CAN", amount: 124.79, tx: "0x0076…54f0", block: 57645422, ageMin: 2 },
      { from: "TFU", to: "HIA", amount: 130.30, tx: "0x886b…fe48", block: 57645446, ageMin: 1 },
      { from: "CAN", to: "XIY", amount: 99.16,  tx: "0xf250…2aa2", block: 57645079, ageMin: 3 },
      { from: "EVN", to: "SVO", amount: 165.30, tx: "0x869b…ffbf", block: 57618444, ageMin: 60 },
      { from: "CGK", to: "CAN", amount: 199.25, tx: "0xd2d5…42ae", block: 57618417, ageMin: 62 },
      { from: "SVO", to: "MMK", amount: 177.81, tx: "0xcb84…6d2b", block: 57618381, ageMin: 64 },
      { from: "SZX", to: "ICN", amount: 156.21, tx: "0x2d78…3767", block: 57603444, ageMin: 88 },
      { from: "SHA", to: "XMN", amount: 182.40, tx: "0x5abe…f563", block: 57601677, ageMin: 95 }
    ],
    /* zone 2b — Daily Settlement Commitment (modal) */
    commitment: {
      algo: "keccak256",
      root: "0xa7ff2c74ff76010e0d5c4bdbb0de9b7709274749629865c33902a7954f6948d5",
      ordersCommitted: 449,
      anchorBlock: 57645446,
      anchorTx: "",              /* optional full tx hash of the root-anchoring transaction */
      officialWallet: ""         /* overrides config.officialWallet when provided */
    },
    /* zone 3 — Overview */
    overview: {
      tvl:        { value: 8200000, label: "stableVault" },
      burned:     { total: 1922670, note: "partiallyConfirmed", network: "Base Mainnet" },
      activeRoutes: { value: 1649, delta: -0.193 },
      lastWeekBurn: { value: 59416.378197, unit: "MXP", note: "prevWeekUtc" },
      apr:        { value: 0.12, tier: "bronzeFlyer", note: "centWeighted" }
    },
    /* zone 4 — Liquidity strip */
    liquidity: {
      todayTotal: 49184, root: "0xa7ff2c74ff76010e0d5c4bdbb0de9b7709274749629865c33902a7954f6948d5",
      settledTickets: 121639, liquidity: 8200000, inFlight: 12, lastSettlementMin: 3
    },
    /* zone 5 — partners marquee (logos hosted in assets/partners) */
    partners: [
      { name: "OSL",      logo: "assets/partners/osl.svg",      role: { en: "Digital asset rails", zh: "数字资产通道" }, url: "https://osl.com" },
      { name: "IATA",     logo: "assets/partners/iata.svg",     role: { en: "Air transport association", zh: "国际航空运输协会" }, url: "https://www.iata.org" },
      { name: "Coinbase", logo: "assets/partners/coinbase.svg", role: { en: "Base · USDC network", zh: "Base · USDC 网络" }, url: "https://www.coinbase.com" },
      { name: "HashKey",  logo: "assets/partners/hashkey.png",  role: { en: "Licensed exchange", zh: "持牌交易所" }, url: "https://group.hashkey.com" },
      { name: "MPChat",   logo: "assets/partners/mpchat.svg",   icon: "assets/partners/mpchat-icon.svg", role: { en: "Super-app partner", zh: "超级应用合作方" }, url: "https://mp.net" }
    ],
    /* zone 6 — Settlement by Route (24h) */
    routes: [
      { from: "SZX", to: "ICN", amount: 1200,   orders: 8 },
      { from: "ICN", to: "SZX", amount: 1130,   orders: 7 },
      { from: "SHA", to: "XMN", amount: 1820,   orders: 10 },
      { from: "SVO", to: "PVG", amount: 795.51, orders: 2 },
      { from: "SVO", to: "MMK", amount: 746.07, orders: 2 }
    ],
    /* zone 7 — Destination Breakdown + Network Metrics */
    destinations: [
      { key: "cn", share: 95.5 }, { key: "ru", share: 2.3 }, { key: "kr", share: 0.9 }, { key: "id", share: 0.7 },
      { key: "us", share: 0.4 }, { key: "am", share: 0.2 }, { key: "other", share: 0 }
    ],
    metrics: { cumulative: 13860000, avgSettleSec: 2, confirmBlocks: 1, settledRoutes: 4125, refundRate: 0 },
    /* globe */
    airports: {
      PVG: { lat: 31.14, lon: 121.81, city: { en: "Shanghai", zh: "上海" }, cc: "CN" },
      SHA: { lat: 31.20, lon: 121.34, city: { en: "Shanghai", zh: "上海" }, cc: "CN", minor: true },
      SZX: { lat: 22.64, lon: 113.81, city: { en: "Shenzhen", zh: "深圳" }, cc: "CN" },
      CAN: { lat: 23.39, lon: 113.30, city: { en: "Guangzhou", zh: "广州" }, cc: "CN", minor: true },
      PKX: { lat: 39.51, lon: 116.41, city: { en: "Beijing", zh: "北京" }, cc: "CN" },
      XIY: { lat: 34.45, lon: 108.75, city: { en: "Xi'an", zh: "西安" }, cc: "CN" },
      TFU: { lat: 30.31, lon: 104.44, city: { en: "Chengdu", zh: "成都" }, cc: "CN" },
      HIA: { lat: 33.79, lon: 119.13, city: { en: "Huai'an", zh: "淮安" }, cc: "CN", minor: true },
      XMN: { lat: 24.54, lon: 118.13, city: { en: "Xiamen", zh: "厦门" }, cc: "CN" },
      URC: { lat: 43.90, lon: 87.47,  city: { en: "Urumqi", zh: "乌鲁木齐" }, cc: "CN" },
      ICN: { lat: 37.46, lon: 126.44, city: { en: "Seoul", zh: "首尔" }, cc: "KR" },
      SVO: { lat: 55.97, lon: 37.41,  city: { en: "Moscow", zh: "莫斯科" }, cc: "RU" },
      MMK: { lat: 68.78, lon: 32.75,  city: { en: "Murmansk", zh: "摩尔曼斯克" }, cc: "RU" },
      LED: { lat: 59.80, lon: 30.26,  city: { en: "St. Petersburg", zh: "圣彼得堡" }, cc: "RU" },
      EVN: { lat: 40.15, lon: 44.40,  city: { en: "Yerevan", zh: "埃里温" }, cc: "AM" },
      CGK: { lat: -6.13, lon: 106.66, city: { en: "Jakarta", zh: "雅加达" }, cc: "ID" },
      KUL: { lat: 2.75,  lon: 101.71, city: { en: "Kuala Lumpur", zh: "吉隆坡" }, cc: "MY" },
      SIN: { lat: 1.36,  lon: 103.99, city: { en: "Singapore", zh: "新加坡" }, cc: "SG" },
      BKK: { lat: 13.69, lon: 100.75, city: { en: "Bangkok", zh: "曼谷" }, cc: "TH" },
      HKG: { lat: 22.31, lon: 113.91, city: { en: "Hong Kong", zh: "香港" }, cc: "HK", minor: true },
      NRT: { lat: 35.77, lon: 140.39, city: { en: "Tokyo", zh: "东京" }, cc: "JP" },
      DXB: { lat: 25.25, lon: 55.36,  city: { en: "Dubai", zh: "迪拜" }, cc: "AE" },
      LHR: { lat: 51.47, lon: -0.45,  city: { en: "London", zh: "伦敦" }, cc: "GB" },
      CDG: { lat: 49.01, lon: 2.55,   city: { en: "Paris", zh: "巴黎" }, cc: "FR" },
      JFK: { lat: 40.64, lon: -73.78, city: { en: "New York", zh: "纽约" }, cc: "US" },
      LAX: { lat: 33.94, lon: -118.41, city: { en: "Los Angeles", zh: "洛杉矶" }, cc: "US" },
      SEA: { lat: 47.45, lon: -122.31, city: { en: "Seattle", zh: "西雅图" }, cc: "US" },
      SYD: { lat: -33.94, lon: 151.18, city: { en: "Sydney", zh: "悉尼" }, cc: "AU" }
    },
    hubs: {},   /* optional per-airport extras: { "PVG": { airlines: ["MU","FM"], todaySettlement: 1234.5 } } */
    networkRoutes: [
      ["PVG", "LHR"], ["PKX", "CDG"], ["CAN", "DXB"], ["DXB", "LHR"], ["HKG", "SIN"], ["BKK", "NRT"],
      ["NRT", "LAX"], ["PVG", "JFK"], ["ICN", "SEA"], ["SZX", "BKK"], ["SIN", "SYD"], ["CDG", "JFK"],
      ["HKG", "SVO"], ["KUL", "HKG"], ["PVG", "NRT"], ["SEA", "JFK"], ["LAX", "JFK"], ["SIN", "DXB"]
    ]
  };
  root.DFLY_SEED = SEED;
  if (typeof module !== "undefined" && module.exports) module.exports = SEED;
})(typeof window !== "undefined" ? window : globalThis);

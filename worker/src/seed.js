// AUTO-GENERATED from docs/js/seed.js — run `node scripts/build-seed.mjs`
export default {
  "schema": 1,
  "meta": {
    "network": "BASE Mainnet",
    "chainId": 8453,
    "block": 57216761,
    "explorer": "https://basescan.org",
    "location": {
      "en": "Shanghai",
      "zh": "上海"
    },
    "timezone": "Asia/Shanghai"
  },
  "supplyChain": {
    "status": "executing",
    "kpis": {
      "capitalPool": {
        "value": 10800000,
        "share": 0.36
      },
      "monthlyProcurement": {
        "value": 2300000,
        "delta": 0.417
      },
      "turnover": {
        "value": 0.94,
        "delta": 0.084
      },
      "activeRoutes": {
        "value": 1623,
        "delta": -0.184
      }
    },
    "flow": [
      "usdc",
      "osl",
      "procurement",
      "distribution",
      "recycle"
    ],
    "today": {
      "amount": 27000,
      "tickets": 226
    },
    "ticker": [
      {
        "from": "PVG",
        "to": "XIY",
        "amount": 87,
        "tx": "0x130b…ca11",
        "block": 57216710,
        "ageMin": 3
      },
      {
        "from": "CTU",
        "to": "PVG",
        "amount": 95,
        "tx": "0x5abe…f563",
        "block": 57216677,
        "ageMin": 3
      },
      {
        "from": "KWE",
        "to": "JHG",
        "amount": 65.08,
        "tx": "0x1eb3…7ade",
        "block": 57216652,
        "ageMin": 4
      },
      {
        "from": "URC",
        "to": "XIY",
        "amount": 118,
        "tx": "0x9c40…21fd",
        "block": 57216611,
        "ageMin": 5
      },
      {
        "from": "ICN",
        "to": "SZX",
        "amount": 156,
        "tx": "0x77e2…0b9a",
        "block": 57216570,
        "ageMin": 6
      }
    ],
    "dailyRoot": {
      "hash": "0xa60c…76ca",
      "block": 57216761
    }
  },
  "liquidity": {
    "queryHash": "0xa7ff2c74ff76010e0d5c4bdbb0de9b7709274749629865c33902a7954f6948d5",
    "block": 57216761,
    "lastSettlementMin": 4,
    "todayTotal": 26979.26,
    "root": "0xa7ff…48d5",
    "settledTickets": 120494,
    "liquidity": 10800000,
    "inFlight": 12
  },
  "feed": [
    {
      "from": "VKO",
      "to": "LED",
      "amount": 101.26,
      "tx": "0xa3bb…878e",
      "block": 57212472,
      "ageMin": 18,
      "featured": true
    },
    {
      "from": "KUL",
      "to": "CGK",
      "amount": 80.41,
      "tx": "0xefc3…bc20",
      "block": 57212457,
      "ageMin": 18
    },
    {
      "from": "KWE",
      "to": "JHG",
      "amount": 65.08,
      "tx": "0x1eb3…7ade",
      "block": 57216761,
      "ageMin": 4
    },
    {
      "from": "SZX",
      "to": "ICN",
      "amount": 156.21,
      "tx": "0x2d78…3767",
      "block": 57203444,
      "ageMin": 48
    },
    {
      "from": "PVG",
      "to": "XIY",
      "amount": 87,
      "tx": "0x130b…ca11",
      "block": 57216710,
      "ageMin": 3
    },
    {
      "from": "CTU",
      "to": "PVG",
      "amount": 95,
      "tx": "0x5abe…f563",
      "block": 57216677,
      "ageMin": 3
    }
  ],
  "commitment": {
    "algo": "keccak256",
    "root": "0xa7ff2c74ff76010e0d5c4bdbb0de9b7709274749629865c33902a7954f6948d5",
    "ordersCommitted": 226,
    "anchorBlock": 57216761
  },
  "settlementFlow": {
    "buyer": "OTA platform",
    "contract": "0xa60c…76ca",
    "airline": "BSP carrier",
    "fundsIn": 26979.26,
    "netRelease": 26979.26,
    "reserve": 0
  },
  "routes": [
    {
      "from": "ICN",
      "to": "SZX",
      "amount": 2210,
      "orders": 14
    },
    {
      "from": "PKX",
      "to": "SVO",
      "amount": 2100,
      "orders": 4
    },
    {
      "from": "URC",
      "to": "XIY",
      "amount": 2510,
      "orders": 21
    },
    {
      "from": "CGK",
      "to": "CAN",
      "amount": 1390,
      "orders": 9
    },
    {
      "from": "CAN",
      "to": "CGK",
      "amount": 1180,
      "orders": 6
    }
  ],
  "metrics": {
    "cumulative": 13730000,
    "avgSettleSec": 2,
    "confirmBlocks": 1,
    "settledRoutes": 4118,
    "refundRate": 0
  },
  "destinations": [
    {
      "key": "cn",
      "share": 94.5
    },
    {
      "key": "ru",
      "share": 3.4
    },
    {
      "key": "id",
      "share": 0.9
    },
    {
      "key": "kr",
      "share": 0.6
    },
    {
      "key": "other",
      "share": 0.2
    },
    {
      "key": "my",
      "share": 0.1
    },
    {
      "key": "vn",
      "share": 0.1
    }
  ],
  "airports": {
    "ICN": {
      "lat": 37.46,
      "lon": 126.44,
      "city": {
        "en": "Seoul",
        "zh": "首尔"
      }
    },
    "SZX": {
      "lat": 22.64,
      "lon": 113.81,
      "city": {
        "en": "Shenzhen",
        "zh": "深圳"
      }
    },
    "PKX": {
      "lat": 39.51,
      "lon": 116.41,
      "city": {
        "en": "Beijing",
        "zh": "北京"
      }
    },
    "SVO": {
      "lat": 55.97,
      "lon": 37.41,
      "city": {
        "en": "Moscow",
        "zh": "莫斯科"
      }
    },
    "VKO": {
      "lat": 55.59,
      "lon": 37.26,
      "city": {
        "en": "Moscow",
        "zh": "莫斯科"
      },
      "minor": true
    },
    "LED": {
      "lat": 59.8,
      "lon": 30.26,
      "city": {
        "en": "St. Petersburg",
        "zh": "圣彼得堡"
      }
    },
    "URC": {
      "lat": 43.9,
      "lon": 87.47,
      "city": {
        "en": "Urumqi",
        "zh": "乌鲁木齐"
      }
    },
    "XIY": {
      "lat": 34.45,
      "lon": 108.75,
      "city": {
        "en": "Xi'an",
        "zh": "西安"
      }
    },
    "CGK": {
      "lat": -6.13,
      "lon": 106.66,
      "city": {
        "en": "Jakarta",
        "zh": "雅加达"
      }
    },
    "CAN": {
      "lat": 23.39,
      "lon": 113.3,
      "city": {
        "en": "Guangzhou",
        "zh": "广州"
      },
      "minor": true
    },
    "KUL": {
      "lat": 2.75,
      "lon": 101.71,
      "city": {
        "en": "Kuala Lumpur",
        "zh": "吉隆坡"
      }
    },
    "KWE": {
      "lat": 26.54,
      "lon": 106.8,
      "city": {
        "en": "Guiyang",
        "zh": "贵阳"
      }
    },
    "JHG": {
      "lat": 21.97,
      "lon": 100.76,
      "city": {
        "en": "Xishuangbanna",
        "zh": "西双版纳"
      }
    },
    "PVG": {
      "lat": 31.14,
      "lon": 121.81,
      "city": {
        "en": "Shanghai",
        "zh": "上海"
      }
    },
    "CTU": {
      "lat": 30.58,
      "lon": 103.95,
      "city": {
        "en": "Chengdu",
        "zh": "成都"
      }
    },
    "HKG": {
      "lat": 22.31,
      "lon": 113.91,
      "city": {
        "en": "Hong Kong",
        "zh": "香港"
      },
      "minor": true
    },
    "SIN": {
      "lat": 1.36,
      "lon": 103.99,
      "city": {
        "en": "Singapore",
        "zh": "新加坡"
      }
    },
    "BKK": {
      "lat": 13.69,
      "lon": 100.75,
      "city": {
        "en": "Bangkok",
        "zh": "曼谷"
      }
    },
    "NRT": {
      "lat": 35.77,
      "lon": 140.39,
      "city": {
        "en": "Tokyo",
        "zh": "东京"
      }
    },
    "DXB": {
      "lat": 25.25,
      "lon": 55.36,
      "city": {
        "en": "Dubai",
        "zh": "迪拜"
      }
    },
    "LHR": {
      "lat": 51.47,
      "lon": -0.45,
      "city": {
        "en": "London",
        "zh": "伦敦"
      }
    },
    "CDG": {
      "lat": 49.01,
      "lon": 2.55,
      "city": {
        "en": "Paris",
        "zh": "巴黎"
      }
    },
    "LAX": {
      "lat": 33.94,
      "lon": -118.41,
      "city": {
        "en": "Los Angeles",
        "zh": "洛杉矶"
      }
    },
    "JFK": {
      "lat": 40.64,
      "lon": -73.78,
      "city": {
        "en": "New York",
        "zh": "纽约"
      }
    }
  },
  "hubs": {},
  "networkRoutes": [
    [
      "PVG",
      "LHR"
    ],
    [
      "PKX",
      "CDG"
    ],
    [
      "CAN",
      "DXB"
    ],
    [
      "DXB",
      "LHR"
    ],
    [
      "HKG",
      "SIN"
    ],
    [
      "BKK",
      "NRT"
    ],
    [
      "NRT",
      "LAX"
    ],
    [
      "PVG",
      "JFK"
    ],
    [
      "ICN",
      "LAX"
    ],
    [
      "SZX",
      "BKK"
    ],
    [
      "SIN",
      "DXB"
    ],
    [
      "CDG",
      "JFK"
    ],
    [
      "HKG",
      "SVO"
    ],
    [
      "KUL",
      "HKG"
    ],
    [
      "PVG",
      "NRT"
    ]
  ]
};

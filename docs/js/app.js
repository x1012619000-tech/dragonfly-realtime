/* Dragonfly Real-time data v3 — app shell: stage scaling, i18n, zones, modals, polling, simulation. */
(function () {
  "use strict";
  var CFG = window.DFLY_CONFIG || {};
  var I18N = window.DFLY_I18N;
  var qs = new URLSearchParams(location.search);
  var API = qs.get("api") || CFG.api || "";
  var LOOKUP = qs.get("lookup") || CFG.lookupApi || "";
  var VERIFY = qs.get("verify") || CFG.verifyApi || "";
  var POLL = Math.max(3000, +(qs.get("poll") || CFG.pollMs || 10000));
  var REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var $ = function (id) { return document.getElementById(id); };
  var bus = new EventTarget();
  function emit(n, d) { bus.dispatchEvent(new CustomEvent(n, { detail: d })); }

  /* ---------------- state ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var S = clone(window.DFLY_SEED);
  var mode = "sim", lastSync = null;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var lang = qs.get("lang") || store.get("dfly-lang") || "en";
  if (!I18N[lang]) lang = "en";
  function stamp(list) { var now = Date.now(); (list || []).forEach(function (r) { if (r.ts == null) r.ts = now - (r.ageMin || 0) * 60000; else if (typeof r.ts === "string") r.ts = Date.parse(r.ts); }); }
  stamp(S.feed);

  /* ---------------- helpers ---------------- */
  function t(k) { var d = I18N[lang]; return d[k] != null ? d[k] : (I18N.en[k] != null ? I18N.en[k] : k); }
  function city(c) { var a = S.airports[c]; return a ? (a.city[lang] || a.city.en) : c; }
  function nf(n, d) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function short(n, d) { var a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toFixed(d == null ? 2 : d) + "M"; if (a >= 1e3) return (n / 1e3).toFixed(d == null ? 2 : d) + "K"; return nf(n, 2); }
  function pct(v, sign) { var s = (v * 100).toFixed(1) + "%"; return sign && v > 0 ? "+" + s : s; }
  function ago(ts) { var m = Math.max(0, Math.floor((Date.now() - ts) / 60000)); if (m < 1) return t("now"); if (m < 60) return m + "m"; return Math.floor(m / 60) + "h " + (m % 60) + "m"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function EXP() { return (S.meta.explorer || "https://basescan.org").replace(/\/$/, ""); }
  function isTx(h) { return /^0x[0-9a-fA-F]{64}$/.test(h || ""); }
  function txUrl(h, blk) { return isTx(h) ? EXP() + "/tx/" + h : EXP() + "/block/" + blk; }
  function randHex(n) { var s = ""; for (var i = 0; i < n; i++) s += "0123456789abcdef"[Math.random() * 16 | 0]; return s; }
  function shortHash(h, a, b) { a = a || 6; b = b || 4; return h && h.length > a + b + 2 && h.indexOf("…") < 0 ? h.slice(0, a) + "…" + h.slice(-b) : h; }
  function delta(d) { var c = d > 0 ? "up" : d < 0 ? "down" : ""; return '<span class="' + c + '">' + (d > 0 ? "▲ " : d < 0 ? "▼ " : "") + pct(d, true) + "</span>"; }
  function ll(a) { return Math.abs(a.lat).toFixed(1) + (a.lat >= 0 ? "N " : "S ") + Math.abs(a.lon).toFixed(1) + (a.lon >= 0 ? "E" : "W"); }

  /* ---------------- stage scaling (letterbox) ---------------- */
  var stage = $("stage");
  window.DFLY_SCALE = 1;
  function fit() {
    var w = innerWidth, h = innerHeight, s = Math.min(w / 1920, h / 1080);
    stage.style.transform = "translate(" + ((w - 1920 * s) / 2) + "px," + ((h - 1080 * s) / 2) + "px) scale(" + s + ")";
    window.DFLY_SCALE = s; emit("resize");
  }
  addEventListener("resize", fit); fit();

  /* ---------------- number tween ---------------- */
  function tween(el, to, fmt) {
    if (!el) return;
    var from = el._v == null ? to : el._v; el._v = to;
    function put(v) { var h = fmt(v); if (el._h !== h) { el._h = h; el.innerHTML = h; } }
    if (REDUCED || from === to) return put(to);
    var t0 = performance.now(), dur = 1100;
    cancelAnimationFrame(el._raf);
    (function step(now) { var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); put(from + (to - from) * e); if (k < 1) el._raf = requestAnimationFrame(step); })(t0);
  }
  function money(v, d) { var s = short(v, d == null ? 1 : d); return "$" + s.replace(/([MK])$/, '<span class="u">$1</span>'); }

  /* ---------------- seamless vertical loop ---------------- */
  function Loop(root, speed) {
    this.root = root; this.inner = root.querySelector(".loop-in"); this.speed = speed; this.off = 0; this.h = 0; this.paused = false;
    var self = this;
    root.addEventListener("mouseenter", function () { self.paused = true; });
    root.addEventListener("mouseleave", function () { self.paused = false; });
  }
  Loop.prototype.set = function (html) {
    this.inner.innerHTML = html;
    var h = this.inner.scrollHeight;
    if (h > this.root.clientHeight + 4) { this.inner.innerHTML = html + '<div aria-hidden="true">' + html + "</div>"; this.h = h; this.off = this.off % h; }
    else { this.h = 0; this.off = 0; }
    this.apply();
  };
  Loop.prototype.apply = function () { this.inner.style.transform = "translate3d(0," + (-this.off).toFixed(2) + "px,0)"; };
  Loop.prototype.step = function (dt) { if (!this.h || this.paused || REDUCED) return; this.off = (this.off + this.speed * dt) % this.h; this.apply(); };
  var loopFeed = new Loop($("feed"), 16), loopBars = new Loop($("bars"), 12);
  var lastF = performance.now();
  (function frame(now) { var dt = Math.min(0.1, (now - lastF) / 1000); lastF = now; loopFeed.step(dt); loopBars.step(dt); requestAnimationFrame(frame); })(lastF);

  /* ---------------- ZONE 1 ---------------- */
  function rowHtml(r, i, feat) {
    var tx = r.txFull || r.tx;
    return '<div class="row' + (r._new && !feat ? " new" : "") + '" data-hub="' + esc(r.from) + '" title="' + esc(city(r.from) + " → " + city(r.to)) + '"><span class="st"></span>' +
      '<span class="rt">' + esc(r.from) + ' <span class="dim">→</span> ' + esc(r.to) + "</span>" +
      '<span class="amt">' + nf(r.amount, 2) + "<small>USDC</small></span>" +
      '<span class="tx"><a href="' + txUrl(tx, r.block) + '" target="_blank" rel="noopener">' + esc(shortHash(tx)) + "</a></span>" +
      '<span class="bk">#' + nf(r.block) + " · " + ago(r.ts) + "</span></div>";
  }
  function renderZ1() {
    var k = S.supplyChain.kpis;
    tween($("k1"), k.capitalPool.value, function (v) { return money(v, 1); });
    $("k1d").innerHTML = '<span class="warn">' + pct(k.capitalPool.share) + "</span> " + esc(t("ofTotal"));
    tween($("k2"), k.monthlyProcurement.value, function (v) { return money(v, 1); });
    $("k2d").innerHTML = delta(k.monthlyProcurement.delta);
    tween($("k3"), k.turnover.value * 100, function (v) { return v.toFixed(0) + '<span class="u">%</span>'; });
    $("k3d").innerHTML = delta(k.turnover.delta);
    tween($("k4"), k.activeRoutes.value, function (v) { return nf(v); });
    $("k4d").innerHTML = delta(k.activeRoutes.delta);
    var run = (S.supplyChain.status || "running") === "running";
    $("scStatus").style.opacity = run ? 1 : .4;
    renderFeed();
  }
  var featTop = null;
  function renderFeed() {
    var f = S.feed[0];
    if (f) {
      $("feat").innerHTML = '<span class="tag">' + esc(t("latest")) + "</span>" + rowHtml(f, 0, true);
      if (featTop && featTop !== f) { var el = $("feat"); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
      featTop = f;
    }
    loopFeed.set(S.feed.slice(1).map(function (r, i) { return rowHtml(r, i); }).join(""));
    S.feed.forEach(function (r) { r._new = false; });
  }

  /* ---------------- ZONE 3 ---------------- */
  function renderZ3() {
    var o = S.overview;
    tween($("o_tvl"), o.tvl.value, function (v) { return money(v, 1).replace('<span class="u">M</span>', '<span class="u">m</span>'); });
    tween($("o_burn"), o.burned.total, function (v) { return nf(v); });
    tween($("o_routes"), o.activeRoutes.value, function (v) { return nf(v); });
    $("o_routes_d").innerHTML = delta(o.activeRoutes.delta);
    tween($("o_week"), o.lastWeekBurn.value, function (v) { return nf(v, 6); });
    tween($("o_apr"), o.apr.value * 100, function (v) { return v.toFixed(0) + '<span class="u">%</span>'; });
  }

  /* ---------------- ZONE 4 ---------------- */
  function renderZ4() {
    var L = S.liquidity;
    tween($("l_total"), L.todayTotal, function (v) { return nf(v, 0); });
    $("l_root").textContent = shortHash(L.root || S.commitment.root, 8, 6);
    tween($("l_tix"), L.settledTickets, function (v) { return nf(v); });
    tween($("l_liq"), L.liquidity, function (v) { return money(v, 1); });
    tween($("l_fly"), L.inFlight, function (v) { return nf(v); });
  }
  $("l_verify").addEventListener("click", function (e) { e.preventDefault(); openModal("commit"); });

  /* ---------------- ZONE 5 ---------------- */
  function renderZ5() {
    var one = (S.partners || []).map(function (p) {
      var img = p.icon ? '<img class="ico-only" src="' + esc(p.icon) + '" alt="">' : '<img src="' + esc(p.logo) + '" alt="">';
      return '<a class="pt" href="' + esc(p.url || "#") + '" target="_blank" rel="noopener" title="' + esc(p.name) + '"><span class="lg-box">' + img + '</span><span class="pn"><b>' + esc(p.name) + "</b><span>" + esc((p.role && (p.role[lang] || p.role.en)) || "") + "</span></span></a>";
    }).join("");
    $("mqIn").innerHTML = one + one.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ');
  }

  /* ---------------- ZONE 6 ---------------- */
  function renderZ6() {
    var max = Math.max.apply(null, S.routes.map(function (r) { return r.amount; }).concat([1]));
    var html = S.routes.map(function (r) {
      var amt = r.amount >= 1000 ? (r.amount / 1000).toFixed(2).replace(/0$/, "") + "K" : nf(r.amount, 2);
      return '<div class="bar" data-hub="' + esc(r.from) + '"><div class="bn">' + esc(r.from) + ' <span class="dim">→</span> ' + esc(r.to) + "<small>" + esc(city(r.from)) + " – " + esc(city(r.to)) + '</small></div><div class="tr2"><i class="fill" style="width:' + (r.amount / max * 100).toFixed(1) + '%"></i></div><div class="bv">' + amt + "<small>" + (r.orders || 0) + " " + esc(r.orders === 1 ? t("order") : t("orders")) + "</small></div></div>";
    }).join("");
    loopBars.set(html);
  }

  /* ---------------- ZONE 7 ---------------- */
  var DCOL = { cn: "#e9edf0", ru: "#d6a75f", kr: "#a2abb3", id: "#77818a", us: "#c6b08a", am: "#525a61", other: "#30353a", my: "#8a939b", vn: "#5f676e" };
  function arcPath(r, a0, a1, w) {
    var r2 = r - w, la = a1 - a0 > Math.PI ? 1 : 0;
    function p(rr, a) { return (Math.sin(a) * rr).toFixed(2) + " " + (-Math.cos(a) * rr).toFixed(2); }
    return "M" + p(r, a0) + "A" + r + " " + r + " 0 " + la + " 1 " + p(r, a1) + "L" + p(r2, a1) + "A" + r2 + " " + r2 + " 0 " + la + " 0 " + p(r2, a0) + "Z";
  }
  function renderZ7() {
    var D = S.destinations.slice(), tot = D.reduce(function (s, d) { return s + d.share; }, 0) || 1;
    var minA = 0.05, gap = 0.018, vis = D.filter(function (d) { return d.share > 0; });
    var big = vis.reduce(function (s, d) { return s + Math.max(d.share / tot * Math.PI * 2, minA); }, 0);
    var k = (Math.PI * 2 - gap * vis.length) / big, a = 0, svg = "";
    svg += '<circle r="74" fill="none" stroke="rgba(214,224,234,.16)" stroke-dasharray="1 3"/>';
    svg += '<circle r="44" fill="none" stroke="rgba(214,224,234,.1)"/>';
    vis.forEach(function (d) {
      var span = Math.max(d.share / tot * Math.PI * 2, minA) * k;
      svg += '<path data-k="' + d.key + '" d="' + arcPath(66, a, a + span, 14) + '" fill="' + (DCOL[d.key] || "#666") + '"><title>' + esc(t(d.key)) + " " + d.share + "%</title></path>";
      a += span + gap;
    });
    var top = vis[0] || { key: "cn", share: 0 };
    svg += '<text y="2" text-anchor="middle" font-size="22" fill="#eef1f3" font-weight="500">' + top.share.toFixed(1) + '<tspan font-size="12" fill="#a3abb3">%</tspan></text>';
    svg += '<text y="20" text-anchor="middle" font-size="8.5" fill="#69717a" letter-spacing="1.2" style="font-family:var(--sans);text-transform:uppercase">' + esc(t(top.key)) + "</text>";
    $("donut").innerHTML = svg;
    $("legend").innerHTML = D.map(function (d) { return '<div class="lg" data-k="' + d.key + '"><i style="background:' + (DCOL[d.key] || "#666") + '"></i><span>' + esc(t(d.key)) + "</span><b>" + d.share.toFixed(1) + "%</b></div>"; }).join("");
    var M = S.metrics;
    tween($("m1"), M.cumulative, function (v) { return (v / 1e6).toFixed(2) + '<span class="u">M</span>'; });
    $("m2").innerHTML = "~" + M.avgSettleSec + '<span class="u">s</span>';
    tween($("m3"), M.settledRoutes, function (v) { return nf(v); });
    tween($("m4"), M.refundRate * 100, function (v) { return v.toFixed(0) + '<span class="u">%</span>'; });
  }
  $("legend").addEventListener("mouseover", function (e) { var l = e.target.closest(".lg"); hlDonut(l && l.dataset.k); });
  $("legend").addEventListener("mouseleave", function () { hlDonut(null); });
  function hlDonut(k) { document.querySelectorAll("#donut path").forEach(function (p) { p.style.opacity = !k || p.dataset.k === k ? 1 : .25; p.style.transition = "opacity .25s"; }); }

  /* ---------------- header / live ---------------- */
  function renderLive() {
    var row = $("liveRow"); row.classList.toggle("live", mode === "live");
    $("liveMode").textContent = mode === "live" ? t("live") : t("simulated");
    $("liveTime").textContent = lastSync ? pad(lastSync.getHours()) + ":" + pad(lastSync.getMinutes()) + ":" + pad(lastSync.getSeconds()) : "--:--:--";
    $("hdrBlock").textContent = "#" + nf(S.meta.block);
  }
  function synced() { lastSync = new Date(); renderLive(); }
  function tickClock() {
    var tz = S.meta.timezone || "Asia/Shanghai";
    var p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" }).formatToParts(new Date());
    var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    $("clock").textContent = o.hour + ":" + o.minute + ":" + o.second;
    $("date").textContent = o.year + "-" + o.month + "-" + o.day;
    $("weekday").textContent = t("weekday")[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(o.weekday)] || o.weekday;
    $("loc").textContent = S.meta.location ? (S.meta.location[lang] || S.meta.location.en) : "";
  }

  function renderAll() { renderZ1(); renderZ3(); renderZ4(); renderZ6(); renderZ7(); renderLive(); if (popCode) renderPop(); }

  /* ---------------- i18n ---------------- */
  function applyLang() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = t("title");
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    var b = $("langBtn"); b.querySelector(".l-en").classList.toggle("on", lang === "en"); b.querySelector(".l-zh").classList.toggle("on", lang === "zh");
    renderZ5(); renderAll(); tickClock();
    if (curModal) renderModal(curModal, true);
    emit("lang");
  }
  $("langBtn").addEventListener("click", function () { lang = lang === "en" ? "zh" : "en"; store.set("dfly-lang", lang); applyLang(); });

  /* ---------------- globe data helpers (shared with globe.js) ---------------- */
  function allArcs() {
    var seen = {}, out = [];
    function add(a, b, net) { if (!S.airports[a] || !S.airports[b] || a === b) return; var k = a < b ? a + b : b + a; if (seen[k]) { if (!net) seen[k].net = false; return; } seen[k] = { a: a, b: b, net: net }; out.push(seen[k]); }
    S.routes.forEach(function (r) { add(r.from, r.to, false); });
    S.feed.forEach(function (r) { add(r.from, r.to, false); });
    (S.networkRoutes || []).forEach(function (r) { add(r[0], r[1], true); });
    return out;
  }
  function hubInfo(code) {
    var routes = {}, total = 0;
    function add(r, isAgg) {
      if (r.from !== code && r.to !== code) return;
      var k = r.from + ">" + r.to, o = routes[k] || (routes[k] = { from: r.from, to: r.to, amount: 0, orders: 0, net: false });
      o.amount += r.amount; o.orders += isAgg ? (r.orders || 0) : 1; total += r.amount;
    }
    S.routes.forEach(function (r) { add(r, true); });
    S.feed.forEach(function (r) { add(r, false); });
    (S.networkRoutes || []).forEach(function (p) { if (p[0] === code || p[1] === code) { var k = p[0] + ">" + p[1]; if (!routes[k] && !routes[p[1] + ">" + p[0]]) routes[k] = { from: p[0], to: p[1], amount: 0, orders: 0, net: true }; } });
    var ext = (S.hubs || {})[code] || {};
    var list = Object.keys(routes).map(function (k) { return routes[k]; }).sort(function (a, b) { return b.amount - a.amount; });
    return { code: code, routes: list, today: ext.todaySettlement != null ? ext.todaySettlement : total, airlines: ext.airlines || null };
  }

  /* ---------------- hub popover ---------------- */
  var popCode = null, popXY = [0, 0];
  function renderPop() {
    var a = S.airports[popCode]; if (!a) return closePop();
    var h = hubInfo(popCode);
    var rows = h.routes.slice(0, 5).map(function (r) {
      return '<div class="pop-r"><span>' + esc(r.from) + " → " + esc(r.to) + ' <span class="dim">' + esc(city(r.from === popCode ? r.to : r.from)) + "</span></span><b" + (r.net ? ' class="dim"' : "") + ">" + (r.net ? t("network").toUpperCase() : "$" + nf(r.amount, 2)) + "</b></div>";
    }).join("") || '<div class="empty">' + esc(t("noRoutes")) + "</div>";
    $("pop").innerHTML = '<i class="cnr"></i><header class="ph"><span class="ico"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg></span><h2>' + esc(popCode) + " · " + esc(city(popCode)) + '</h2><button class="x" aria-label="' + esc(t("close")) + '">✕</button></header>' +
      '<div class="pop-b"><div class="pop-k"><div><div class="lbl">' + esc(t("hubToday")) + '</div><div class="num v">$' + nf(h.today, 2) + '</div></div><div class="d num">' + ll(a) + "</div></div>" +
      '<div class="lbl" style="margin:2px 0 4px">' + esc(t("hubRoutes")) + " · " + h.routes.length + "</div>" + rows +
      '<div class="pop-r"><span>' + esc(t("hubAirlines")) + "</span><b" + (h.airlines ? "" : ' class="dim"') + ">" + esc(h.airlines ? h.airlines.join(" · ") : t("pendingApi")) + "</b></div></div>";
    $("pop").querySelector(".x").onclick = closePop;
  }
  function placePop() {
    var p = $("pop"), x = popXY[0], y = popXY[1], pw = 330, ph = p.offsetHeight || 260;
    var left = x + 40, top = y - 40;
    if (left + pw > 1430) left = x - pw - 40;
    left = Math.max(384, Math.min(1430 - pw, left));
    top = Math.max(290, Math.min(940 - ph, top));
    p.style.left = left + "px"; p.style.top = top + "px";
  }
  function openHub(code, x, y) {
    var p = $("pop"); var was = !p.hidden;
    popCode = code; popXY = [x, y]; p.hidden = false; renderPop(); placePop();
    if (!was) { p.classList.remove("show"); void p.offsetWidth; } p.classList.add("show");
    emit("hub", code);
  }
  function movePop(x, y) { if (!popCode) return; popXY = [x, y]; placePop(); }
  function closePop() { if (!popCode) return; popCode = null; var p = $("pop"); p.classList.remove("show"); setTimeout(function () { if (!popCode) p.hidden = true; }, 260); emit("hub", null); }
  function focusHub(code) { if (S.airports[code]) emit("focus", code); }
  document.addEventListener("click", function (e) {
    var r = e.target.closest("[data-hub]"); if (r && !e.target.closest("a")) focusHub(r.dataset.hub);
  });

  /* ---------------- modals ---------------- */
  var curModal = null, lastFocus = null, proofState = { q: "", res: null };
  var ICONS = {
    proof: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.2 10.2 3.6 3.6" stroke="currentColor" stroke-width="1.5"/></svg>',
    commit: '<svg viewBox="0 0 16 16"><path d="M8 2v4M4 7l4-1 4 1M3 10l5 4 5-4M3 10V7M13 10V7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    about: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 7v4.2M8 4.6v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };
  function head(kind, title, sub) {
    return '<i class="cnr"></i><div class="mh"><span class="tab-ic">' + ICONS[kind] + '</span><div><h3 id="modalTitle">' + esc(title) + '</h3><div class="micro">' + esc(sub) + '</div></div><button class="x" data-close aria-label="' + esc(t("close")) + '"><span>' + esc(t("esc")) + "</span> ✕</button></div>";
  }
  function detect(v) {
    v = (v || "").trim();
    if (!v) return null;
    if (/^0x[0-9a-fA-F]{64}$/.test(v)) return "tx";
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) return "wallet";
    if (/^[A-Za-z0-9][A-Za-z0-9\-]{4,24}$/.test(v)) return "ticket";
    return "unknown";
  }
  var TLBL = { ticket: "tTicket", tx: "tTx", wallet: "tWallet", unknown: "tUnknown" };
  function offHtml(type, q) {
    var link = "";
    if (type === "tx") link = '<a class="btn sm" href="' + EXP() + "/tx/" + esc(q) + '" target="_blank" rel="noopener">' + esc(t("openBasescan")) + " ↗</a>";
    if (type === "wallet") link = '<a class="btn sm" href="' + EXP() + "/address/" + esc(q) + '" target="_blank" rel="noopener">' + esc(t("openBasescan")) + " ↗</a>";
    return '<div class="off"><div class="off-ic"><svg viewBox="0 0 96 96" fill="none"><circle cx="48" cy="48" r="44" stroke="rgba(214,224,234,.18)" stroke-dasharray="2 4"/><circle cx="48" cy="48" r="30" stroke="rgba(214,224,234,.3)"/><path d="M30 48h12M54 48h12" stroke="#e9edf0" stroke-width="2.5" stroke-linecap="round"/><path d="M42 40v16M54 40v16" stroke="#d6a75f" stroke-width="2.5" stroke-linecap="round"/><path d="M45 44l6 8" stroke="#d6a75f" stroke-width="1.5" opacity=".5"/></svg></div>' +
      "<div><h4>" + esc(t("apiOffTitle")) + "</h4><p>" + esc(t("apiOffBody")).replace("config.js → lookupApi", "<code>config.js → lookupApi</code>") + "</p>" + (link ? '<div class="acts">' + link + "</div>" : "") + "</div></div>";
  }
  function kv(rows) { return '<div class="kv">' + rows.filter(function (r) { return r[1] != null && r[1] !== ""; }).map(function (r) { return "<div>" + esc(r[0]) + '</div><div class="' + (r[2] || "") + '">' + r[1] + "</div>"; }).join("") + "</div>"; }
  function resHtml(type, q, j) {
    var r = j.result || {};
    if (!j.ok || !j.result) return '<div class="center">' + esc(t("noResult")) + "</div>";
    var tx = function (h, b) { return h ? '<a class="link" style="text-transform:none;letter-spacing:0" href="' + txUrl(h, b) + '" target="_blank" rel="noopener">' + esc(h) + "</a>" : ""; };
    if ((j.type || type) === "ticket") return kv([[t("tTicket"), esc(r.ticketNo || q), "mono"], [t("rRoute"), esc(r.route || "")], [t("rStatus"), esc(r.status || "")], [t("rAmount"), r.amount != null ? nf(r.amount, 2) + " USDC" : "", "mono"], [t("rTx"), tx(r.tx, r.block), "mono"], [t("rBlock"), r.block ? "#" + nf(r.block) : "", "mono"], [t("rTime"), esc(r.ts || ""), "mono"], [t("rProof"), r.proof ? (r.proof.included ? t("included") : t("notIncluded")) : ""]]);
    if ((j.type || type) === "tx") return kv([[t("tTx"), esc(r.hash || q), "mono"], [t("rStatus"), esc(r.status || "")], [t("rBlock"), r.block ? "#" + nf(r.block) : "", "mono"], ["From", esc(r.from || ""), "mono"], ["To", esc(r.to || ""), "mono"], [t("rAmount"), r.amount != null ? nf(r.amount, 2) + " USDC" : "", "mono"], [t("rTickets"), (r.tickets || []).map(esc).join(", "), "mono"]]);
    return kv([[t("tWallet"), esc(r.address || q), "mono"], [t("rBalance"), r.balance != null ? nf(r.balance, 2) + " USDC" : "", "mono"], [t("rCount"), r.settledCount != null ? nf(r.settledCount) : "", "mono"], [t("rTx"), tx(r.lastTx), "mono"]]);
  }
  function renderProofResult() {
    var box = $("pRes"); if (!box) return;
    var st = proofState;
    if (!st.q) { box.innerHTML = offHtml(null, ""); if (LOOKUP) box.innerHTML = '<div class="center dim">' + esc(t("proofHint")) + "</div>"; return; }
    if (st.loading) { box.innerHTML = '<div class="center"><span class="spin"></span>' + esc(t("searching")) + "</div>"; return; }
    if (!LOOKUP || st.off) { box.innerHTML = offHtml(st.type, st.q); return; }
    if (st.err) { box.innerHTML = '<div class="center" style="color:var(--red)">' + esc(t("errResult")) + " · " + esc(st.err) + "</div>"; return; }
    if (st.res) box.innerHTML = resHtml(st.type, st.q, st.res);
  }
  function runLookup() {
    var q = $("pIn").value.trim(), type = detect(q);
    proofState = { q: q, type: type, res: null };
    if (!q) return renderProofResult();
    if (!LOOKUP) return renderProofResult();
    proofState.loading = true; renderProofResult();
    var u = LOOKUP + (LOOKUP.indexOf("?") < 0 ? "?" : "&") + "q=" + encodeURIComponent(q) + "&type=" + encodeURIComponent(type || "");
    fetch(u, { headers: { Accept: "application/json" } }).then(function (r) { if (r.status === 501) return { _off: true }; return r.json().catch(function () { throw new Error("HTTP " + r.status); }); })
      .then(function (j) { if (proofState.q !== q) return; proofState.loading = false; if (j && j._off) proofState.off = true; else proofState.res = j; renderProofResult(); })
      .catch(function (e) { if (proofState.q !== q) return; proofState.loading = false; proofState.err = e.message || "error"; renderProofResult(); });
  }
  function updDetect() {
    var el = $("pDet"), v = $("pIn").value, d = detect(v);
    el.textContent = d ? t("detect") + " · " + t(TLBL[d]) : t("tTicket") + " / TX / " + t("tWallet");
    el.classList.toggle("ok", !!d && d !== "unknown");
  }
  var verifyState = null;
  function walletAddr() { return S.commitment.officialWallet || qs.get("wallet") || CFG.officialWallet || ""; }
  function renderModal(kind, keep) {
    var m = $("modal"), html = "";
    if (kind === "proof") {
      html = head("proof", t("proofTitle"), t("proofSub")) + '<div class="mb2"><form class="srch" id="pForm" autocomplete="off"><div class="srch-in"><svg class="sic" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m10.4 10.4 3.4 3.4" stroke="currentColor" stroke-width="1.4"/></svg>' +
        '<input id="pIn" spellcheck="false" placeholder="' + esc(t("proofPh")) + '" value="' + esc(proofState.q) + '"><span class="det" id="pDet"></span></div><button class="btn" type="submit">' + esc(t("query")) + ' <span aria-hidden="true">→</span></button></form>' +
        '<div class="hint"><span>' + esc(t("proofHint")) + '</span></div><div class="hint"><span>' + esc(t("tTicket")) + " <b>781-2345678901</b></span><span>" + esc(t("tTx")) + " <b>0x + 64 hex</b></span><span>" + esc(t("tWallet")) + ' <b>0x + 40 hex</b></span></div><div class="res" id="pRes"></div></div>';
    } else if (kind === "commit") {
      var C = S.commitment, w = walletAddr();
      var vr = verifyState ? '<span class="vres ' + (verifyState.cls || "") + '">' + (verifyState.loading ? '<span class="spin" style="width:14px;height:14px"></span>' : "") + esc(verifyState.msg) + (verifyState.link ? ' <a class="link" href="' + verifyState.link + '" target="_blank" rel="noopener">Basescan ↗</a>' : "") + "</span>" : "";
      html = head("commit", t("commitTitle"), t("commitSub")) + '<div class="mb2"><div class="cm-top"><div><div class="lbl">' + esc(t("today")) + " · " + esc(t("committedOnchain")) + '</div><div class="num v">' + nf(C.ordersCommitted) + ' <span class="u">' + esc(t("orders")) + "</span></div></div>" +
        '<div><div class="lbl">' + esc(t("anchored")) + '</div><div class="num v"><a class="link" style="font-size:inherit;letter-spacing:0;text-transform:none;color:var(--ink)" href="' + (C.anchorTx ? EXP() + "/tx/" + C.anchorTx : EXP() + "/block/" + C.anchorBlock) + '" target="_blank" rel="noopener">#' + nf(C.anchorBlock) + ' <span class="u">↗</span></a></div></div></div>' +
        '<div class="rootbox"><div class="lbl gold-l">' + esc(t("queryValue")) + " · " + esc((C.algo || "keccak256").toUpperCase()) + '</div><div class="rv" id="cRoot">' + esc(C.root) + '</div><div class="acts"><button class="btn sm" id="cVerify" type="button">' + esc(t("verifyRoot")) + '</button><button class="btn ghost" id="cCopy" type="button">' + esc(t("copy")) + "</button>" + vr + "</div></div>" +
        '<div class="wallet"><div class="wi"><svg viewBox="0 0 16 16" width="18" height="18"><rect x="1.5" y="4" width="13" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 6.5h13M11 9.5h1.5" stroke="currentColor" stroke-width="1.3"/></svg></div><div><div class="lbl">' + esc(t("officialWallet")) + '</div><div class="wv' + (w ? " set" : "") + '">' + (w ? '<a class="link" style="text-transform:none;letter-spacing:0;font-size:13px" href="' + EXP() + "/address/" + esc(w) + '" target="_blank" rel="noopener">' + esc(w) + " ↗</a>" : esc(t("walletPending"))) + "</div></div></div>" +
        '<p class="cm-note">' + esc(t("commitNote")) + "</p></div>";
    } else {
      html = head("about", t("aboutTitle"), t("aboutSub")) + '<div class="mb2 about"><p>' + esc(t("aboutBody")) + '</p><div class="ph-box"><span class="spin" style="animation-duration:3s;opacity:.5"></span>' + esc(t("aboutTodo")) + "</div></div>";
    }
    m.innerHTML = html;
    if (kind === "proof") {
      updDetect(); renderProofResult();
      $("pIn").addEventListener("input", updDetect);
      $("pForm").addEventListener("submit", function (e) { e.preventDefault(); runLookup(); });
      if (!keep) setTimeout(function () { $("pIn") && $("pIn").focus(); }, 60);
    }
    if (kind === "commit") {
      $("cCopy").onclick = function () { var b = this; try { navigator.clipboard.writeText(S.commitment.root); } catch (e) {} b.textContent = t("copied"); setTimeout(function () { b.textContent = t("copy"); }, 1400); };
      $("cVerify").onclick = verifyRoot;
    }
  }
  function verifyRoot() {
    var C = S.commitment;
    if (!VERIFY) {
      verifyState = { msg: t("verifyOff"), cls: "", link: C.anchorTx ? EXP() + "/tx/" + C.anchorTx : EXP() + "/block/" + C.anchorBlock }; renderModal("commit", true);
      window.open(C.anchorTx ? EXP() + "/tx/" + C.anchorTx : EXP() + "/block/" + C.anchorBlock, "_blank", "noopener");
      return;
    }
    verifyState = { msg: t("verifying"), loading: true }; renderModal("commit", true);
    fetch(VERIFY + (VERIFY.indexOf("?") < 0 ? "?" : "&") + "root=" + encodeURIComponent(C.root) + "&block=" + C.anchorBlock, { headers: { Accept: "application/json" } })
      .then(function (r) { if (r.status === 501) return { _off: true }; return r.json(); })
      .then(function (j) { if (j && j._off) { verifyState = { msg: t("verifyOff"), cls: "", link: C.anchorTx ? EXP() + "/tx/" + C.anchorTx : EXP() + "/block/" + C.anchorBlock }; if (curModal === "commit") renderModal("commit", true); return; } verifyState = j && j.verified ? { msg: t("verifiedOk") + (j.block ? " · #" + nf(j.block) : ""), cls: "ok" } : { msg: t("verifiedBad"), cls: "bad" }; if (curModal === "commit") renderModal("commit", true); })
      .catch(function (e) { verifyState = { msg: t("errResult") + " · " + (e.message || ""), cls: "bad" }; if (curModal === "commit") renderModal("commit", true); });
  }
  function openModal(kind) {
    var w = $("modalWrap");
    closePop();
    lastFocus = document.activeElement;
    curModal = kind; verifyState = null;
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.modal === kind); });
    renderModal(kind);
    w.hidden = false; void w.offsetWidth; w.classList.add("open");
    if (kind !== "proof") setTimeout(function () { var x = w.querySelector(".x"); x && x.focus(); }, 60);
    emit("modal", kind);
  }
  function closeModal() {
    if (!curModal) return;
    var w = $("modalWrap"); curModal = null; w.classList.remove("open");
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.remove("on"); });
    setTimeout(function () { if (!curModal) w.hidden = true; }, 380);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    emit("modal", null);
  }
  document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () { curModal === b.dataset.modal ? closeModal() : openModal(b.dataset.modal); }); });
  $("modalWrap").addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if (curModal) closeModal(); else closePop(); }
    if (e.key === "Tab" && curModal) { // focus trap
      var f = $("modal").querySelectorAll("button,a[href],input"); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });

  /* ---------------- simulation ---------------- */
  var POOL = [["PVG","XIY"],["TFU","PVG"],["URC","XIY"],["ICN","SZX"],["SZX","ICN"],["SVO","LED"],["KUL","CGK"],["PKX","SVO"],["CGK","CAN"],["SHA","XMN"],["SVO","MMK"],["EVN","SVO"],["SVO","PVG"],["TFU","HIA"],["CAN","XIY"],["XMN","SHA"]];
  function simSettle() {
    var p = POOL[Math.random() * POOL.length | 0];
    var amt = Math.round((70 + Math.random() * 130) * 100) / 100;
    var full = "0x" + randHex(64);
    S.feed.unshift({ from: p[0], to: p[1], amount: amt, tx: full, block: S.meta.block, ts: Date.now(), _new: true });
    S.feed.length = Math.min(S.feed.length, 24);
    var L = S.liquidity;
    L.todayTotal = Math.round((L.todayTotal + amt) * 100) / 100; L.settledTickets += 1;
    L.inFlight = Math.max(4, Math.min(30, L.inFlight + (Math.random() * 5 | 0) - 2));
    S.metrics.cumulative += amt;
    S.routes.forEach(function (r) { if (r.from === p[0] && r.to === p[1]) { r.amount = Math.round((r.amount + amt) * 100) / 100; r.orders += 1; } });
    renderAll(); synced();
    emit("settle", { from: p[0], to: p[1], amount: amt });
  }
  function simBlock() { S.meta.block += 1; $("hdrBlock").textContent = "#" + nf(S.meta.block); }
  var simT = null, blkT = null;
  function startSim() { if (simT || CFG.simulate === false) return; simT = setInterval(simSettle, REDUCED ? 9000 : 4200); blkT = setInterval(simBlock, 2000); }
  function stopSim() { clearInterval(simT); clearInterval(blkT); simT = blkT = null; }

  /* ---------------- live API ---------------- */
  var OBJ = ["meta","supplyChain","liquidity","commitment","overview","metrics"], ARR = ["feed","routes","destinations","networkRoutes","partners"];
  function merge(snap) {
    if (!snap || typeof snap !== "object") throw new Error("bad snapshot");
    var prevTop = S.feed[0] && S.feed[0].tx;
    OBJ.forEach(function (k) { if (snap[k]) S[k] = Object.assign({}, S[k], snap[k]); });
    ARR.forEach(function (k) { if (Array.isArray(snap[k])) S[k] = snap[k]; });
    if (snap.airports) S.airports = Object.assign({}, S.airports, snap.airports);
    if (snap.hubs) S.hubs = snap.hubs;
    if (snap.supplyChain && snap.supplyChain.kpis) S.supplyChain.kpis = Object.assign({}, window.DFLY_SEED.supplyChain.kpis, snap.supplyChain.kpis);
    if (snap.overview) Object.keys(window.DFLY_SEED.overview).forEach(function (k) { S.overview[k] = Object.assign({}, window.DFLY_SEED.overview[k], snap.overview[k] || S.overview[k]); });
    stamp(S.feed);
    if (S.feed[0] && S.feed[0].tx !== prevTop) { S.feed[0]._new = true; emit("settle", S.feed[0]); }
    if (Array.isArray(snap.partners)) renderZ5();
  }
  function poll() {
    fetch(API, { cache: "no-store", headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { merge(j); if (mode !== "live") { mode = "live"; stopSim(); } renderAll(); synced(); emit("data"); })
      .catch(function (e) { mode = "sim"; startSim(); renderLive(); console.warn("[dfly] API unavailable, simulating:", e.message); })
      .finally(function () { setTimeout(poll, POLL); });
  }
  function stream(url) { try { var es = new EventSource(url); es.onmessage = function (ev) { try { merge(JSON.parse(ev.data)); mode = "live"; stopSim(); renderAll(); synced(); emit("data"); } catch (e) {} }; } catch (e) {} }

  /* ---------------- boot ---------------- */
  window.DFLY = { state: function () { return S; }, t: t, city: city, lang: function () { return lang; }, bus: bus, allArcs: allArcs, hubInfo: hubInfo,
    openHub: openHub, movePop: movePop, closePop: closePop, popCode: function () { return popCode; }, reduced: REDUCED, openModal: openModal, closeModal: closeModal, ll: ll };
  applyLang(); setInterval(tickClock, 1000);
  setInterval(renderFeed, 30000);
  synced();
  if (API) { poll(); if (CFG.stream) stream(CFG.stream); } else startSim();
  renderLive();
})();

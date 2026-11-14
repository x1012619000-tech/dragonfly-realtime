/* Dragonfly Real-time data — app shell: scaling, i18n, rendering, data polling, simulation. */
(function () {
  "use strict";
  var CFG = window.DFLY_CONFIG || {};
  var I18N = window.DFLY_I18N;
  var qs = new URLSearchParams(location.search);
  var API = qs.get("api") || window.DFLY_API || CFG.api || "";
  var POLL = Math.max(3000, +(qs.get("poll") || CFG.pollMs || 10000));
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };
  var bus = new EventTarget();
  function emit(n, d) { bus.dispatchEvent(new CustomEvent(n, { detail: d })); }

  /* ---------------- state ---------------- */
  var S = clone(window.DFLY_SEED);
  var mode = "sim";          // "live" | "sim"
  var lastSync = null;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var lang = store.get("dfly-lang") || ((navigator.language || "").toLowerCase().indexOf("zh") === 0 && false ? "zh" : "en");
  if (!I18N[lang]) lang = "en";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function stampRows(list) { var now = Date.now(); (list || []).forEach(function (r) { if (r.ts == null) r.ts = now - (r.ageMin || 0) * 60000; else if (typeof r.ts === "string") r.ts = Date.parse(r.ts); }); }
  stampRows(S.feed); stampRows(S.supplyChain.ticker);

  /* ---------------- helpers ---------------- */
  function t(k) { var d = I18N[lang]; return d[k] != null ? d[k] : (I18N.en[k] != null ? I18N.en[k] : k); }
  function city(code) { var a = S.airports[code]; return a ? (a.city[lang] || a.city.en) : code; }
  function nf(n, d) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function short(n, d) {
    var a = Math.abs(n), s;
    if (a >= 1e6) s = (n / 1e6).toFixed(d == null ? 2 : d).replace(/\.?0+$/, "") + "M";
    else if (a >= 1e3) s = (n / 1e3).toFixed(d == null ? 2 : d).replace(/\.?0+$/, "") + "K";
    else s = nf(n, 0);
    return s;
  }
  function pct(v, sign) { var s = (v * 100).toFixed(1) + "%"; return sign && v > 0 ? "+" + s : s; }
  function ago(ts) { var m = Math.max(0, Math.floor((Date.now() - ts) / 60000)); if (m < 1) return lang === "zh" ? "刚刚" : "now"; if (m < 60) return m + "m"; return Math.floor(m / 60) + "h"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var EXP = function () { return (S.meta.explorer || "https://basescan.org").replace(/\/$/, ""); };
  function txUrl(h, blk) { return /^0x[0-9a-fA-F]{64}$/.test(h || "") ? EXP() + "/tx/" + h : EXP() + "/block/" + blk; }
  function blkUrl(b) { return EXP() + "/block/" + b; }
  function randHex(n) { var s = ""; for (var i = 0; i < n; i++) s += "0123456789abcdef"[Math.random() * 16 | 0]; return s; }
  function shortHash(h) { return h && h.length > 20 ? h.slice(0, 6) + "…" + h.slice(-4) : h; }

  /* ---------------- scale to fit ---------------- */
  var stage = $("stage");
  window.DFLY_SCALE = 1;
  function fit() {
    var w = innerWidth, h = innerHeight;
    var stacked = (w < 760) || (w < 1000 && h > w * 1.1);
    document.documentElement.classList.toggle("stacked", stacked);
    if (stacked) { stage.style.transform = ""; window.DFLY_SCALE = 1; }
    else {
      var s = Math.min(w / 1920, h / 1080);
      var x = (w - 1920 * s) / 2, y = (h - 1080 * s) / 2;
      stage.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
      window.DFLY_SCALE = s;
    }
    emit("resize");
  }
  addEventListener("resize", fit); fit();

  /* ---------------- i18n ---------------- */
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = t("title");
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    $("q2in").placeholder = t("hashPh");
    renderAll(true);
    emit("lang");
  }
  $("langBtn").addEventListener("click", function () { lang = lang === "en" ? "zh" : "en"; store.set("dfly-lang", lang); applyLang(); });

  /* ---------------- clock ---------------- */
  function tickClock() {
    var tz = S.meta.timezone || "Asia/Shanghai";
    var now = new Date();
    var p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" }).formatToParts(now);
    var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    $("clock").textContent = o.hour + ":" + o.minute + ":" + o.second;
    $("date").textContent = o.year + "-" + o.month + "-" + o.day;
    var wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(o.weekday);
    $("weekday").textContent = t("weekday")[wd];
    $("loc").textContent = S.meta.location ? (S.meta.location[lang] || S.meta.location.en) : "";
    // uptime DD:HH:MM:SS since meta.since (default: 4 days + offset, purely visual)
    var since = S.meta.since ? Date.parse(S.meta.since) : (UP0);
    var sec = Math.max(0, Math.floor((now - since) / 1000));
    var dd = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60;
    $("cUp").textContent = pad(dd) + ":" + pad(hh) + ":" + pad(mm) + ":" + pad(ss);
    if (lastSync) $("cSync").textContent = "T+" + pad(Math.floor((now - lastSync) / 1000));
  }
  var UP0 = Date.now() - ((4 * 86400) + 18 * 3600 + 33 * 60 + 20) * 1000;
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------------- rolling digit readouts ---------------- */
  function reel(el, str) {
    var chars = String(str).split("");
    if (el._sig !== chars.map(function (c) { return /\d/.test(c) ? "d" : c; }).join("")) {
      el._sig = chars.map(function (c) { return /\d/.test(c) ? "d" : c; }).join("");
      el.innerHTML = chars.map(function (c) {
        return /\d/.test(c) ? '<span class="d"><span class="reel">' + "0123456789".split("").map(function (n) { return "<span>" + n + "</span>"; }).join("") + "</span></span>" : '<span class="s">' + esc(c) + "</span>";
      }).join("");
    }
    var ds = el.querySelectorAll(".d .reel"), i = 0;
    chars.forEach(function (c) { if (/\d/.test(c)) { var r = ds[i++]; var h = r.firstChild.offsetHeight || 38; r.style.transform = "translateY(" + (-(+c) * h) + "px)"; } });
  }

  /* ---------------- tween numbers ---------------- */
  function tween(el, to, fmt) {
    var from = el._v == null ? to : el._v; el._v = to;
    if (REDUCED || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 900;
    cancelAnimationFrame(el._raf);
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(step);
    })(t0);
  }

  /* ---------------- seamless vertical loop scroller ---------------- */
  function Loop(root, speed) {
    this.root = root; this.inner = root.querySelector(".loop-in"); this.speed = speed; this.off = 0; this.paused = false; this.h = 0;
    var self = this;
    root.addEventListener("mouseenter", function () { self.paused = true; });
    root.addEventListener("mouseleave", function () { self.paused = false; });
  }
  Loop.prototype.set = function (html) {
    this.inner.innerHTML = html;
    var vh = this.root.clientHeight;
    var h = this.inner.scrollHeight;
    if (h > vh + 4 && !REDUCED) { this.inner.innerHTML = html + html.replace(/ new"/g, '"'); this.h = h; }
    else { this.h = 0; this.off = 0; this.inner.style.transform = ""; }
    if (this.h) this.off = this.off % this.h;
  };
  Loop.prototype.step = function (dt) {
    if (!this.h || this.paused) return;
    this.off = (this.off + this.speed * dt) % this.h;
    this.inner.style.transform = "translateY(" + (-this.off).toFixed(2) + "px)";
  };
  var loopTicker = new Loop($("ticker"), 9);
  var loopFeed = new Loop($("feed"), 11);
  var lastF = performance.now();
  (function frame(now) { var dt = Math.min(0.1, (now - lastF) / 1000); lastF = now; loopTicker.step(dt); loopFeed.step(dt); requestAnimationFrame(frame); })(lastF);

  /* ---------------- renderers ---------------- */
  var ICON = {
    usdc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M14.5 9.2c-.4-.9-1.3-1.4-2.5-1.4-1.5 0-2.5.8-2.5 1.9 0 2.7 5.2 1.3 5.2 4.2 0 1.2-1.1 2-2.7 2-1.3 0-2.3-.6-2.7-1.6M12 6.3v1.5M12 16v1.6" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    osl: '<svg viewBox="0 0 24 24"><path d="M3 15c3-5 6-7 9-7s6 2 9 7M3 15h18M7 15v-3M12 15V8M17 15v-3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    procurement: '<svg viewBox="0 0 24 24"><path d="M4 6h2l2 9h10l2-7H7.2M10 19a1 1 0 1 0 0 .1M17 19a1 1 0 1 0 0 .1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    distribution: '<svg viewBox="0 0 24 24"><path d="M12 4v6M12 10l-6 5M12 10l6 5M12 10v6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="4" r="1.6" fill="currentColor"/><circle cx="6" cy="16.5" r="1.6" fill="currentColor"/><circle cx="12" cy="17.5" r="1.6" fill="currentColor"/><circle cx="18" cy="16.5" r="1.6" fill="currentColor"/></svg>',
    recycle: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 0 1-12.2 4.7M5 12a7 7 0 0 1 12.2-4.7M17.5 3.5v4h-4M6.5 20.5v-4h4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
  };
  var flowStep = 0;
  function renderFlow() {
    var f = S.supplyChain.flow || [];
    $("flow1").innerHTML = f.map(function (k, i) {
      return (i ? '<i class="flink"></i>' : "") + '<div class="fnode' + (i === flowStep ? " on" : "") + '"><div class="fi">' + (ICON[k] || "") + "</div><span>" + esc(t("f_" + k)) + "</span></div>";
    }).join("");
  }
  function deltaHtml(d, extra) { var c = d > 0 ? "up" : d < 0 ? "down" : ""; var a = d > 0 ? "▲ " : d < 0 ? "▼ " : ""; return '<span class="' + c + '">' + a + pct(d, true) + "</span>" + (extra || ""); }

  function routeHtml(r, idx) {
    return (idx != null ? '<span class="n">' + pad(idx) + "</span>" : "") + esc(city(r.from)) + " <i>→</i> " + esc(city(r.to));
  }
  function rowHtml(r, kind, i) {
    var sub = '<span class="sub">' + r.from + "·" + r.to + ' · <a href="' + txUrl(r.tx, r.block) + '" target="_blank" rel="noopener"><b>' + esc(shortHash(r.tx)) + '</b></a> · <a href="' + blkUrl(r.block) + '" target="_blank" rel="noopener">#' + nf(r.block) + "</a></span>";
    return '<div class="row' + (r._new ? " new" : "") + '"><span class="rt">' + routeHtml(r, kind === "feed" ? i + 1 : null) + '</span><span class="rr">' + (kind === "ticker" ? '<span class="st">✓ ' + esc(t("settled")) + "</span>" : "") + '<span class="amt">' + (kind === "ticker" ? "+" : "") + "$" + nf(r.amount, r.amount % 1 ? 2 : 0) + "</span></span>" + sub + '<span class="age">' + ago(r.ts) + "</span></div>";
  }

  function renderZ1() {
    var sc = S.supplyChain, k = sc.kpis;
    tween($("k_pool"), k.capitalPool.value, function (v) { return "$" + short(v, 1); });
    $("k_pool_d").innerHTML = '<span>' + pct(k.capitalPool.share) + "</span> " + esc(t("ofTotal"));
    tween($("k_proc"), k.monthlyProcurement.value, function (v) { return "$" + short(v, 1); });
    $("k_proc_d").innerHTML = deltaHtml(k.monthlyProcurement.delta);
    tween($("k_turn"), k.turnover.value * 100, function (v) { return v.toFixed(0) + "%"; });
    $("k_turn_d").innerHTML = deltaHtml(k.turnover.delta);
    tween($("k_routes"), k.activeRoutes.value, function (v) { return nf(v); });
    $("k_routes_d").innerHTML = deltaHtml(k.activeRoutes.delta);
    renderFlow();
    tween($("z1Amt"), sc.today.amount, function (v) { return "$" + short(v, 1); });
    tween($("z1Tix"), sc.today.tickets, function (v) { return nf(v); });
    loopTicker.set(sc.ticker.map(function (r) { return rowHtml(r, "ticker"); }).join(""));
    $("z1Root").textContent = shortHash(sc.dailyRoot.hash);
    $("z1RootBlk").textContent = "#" + nf(sc.dailyRoot.block);
    $("z1Verify").href = txUrl(sc.dailyRoot.hash, sc.dailyRoot.block);
    $("z1Explorer").href = sc.explorerUrl || EXP();
  }
  function renderZ2() {
    var L = S.liquidity;
    if (document.activeElement !== $("q2in") && !$("q2in")._dirty) $("q2in").value = (L.queryHash || "").replace(/^0x/, "");
    $("z2Net").textContent = S.meta.network;
    $("z2Blk").textContent = nf(S.meta.block);
    $("z2Last").textContent = L.lastSettlementMin;
    tween($("z2Total"), L.todayTotal, function (v) { return nf(v, 2); });
    $("z2Root").textContent = shortHash(L.root);
    $("z2Verify").href = txUrl(L.queryHash, S.meta.block);
    tween($("z2Tix"), L.settledTickets, function (v) { return nf(v); });
    tween($("z2Liq"), L.liquidity, function (v) { return "$" + short(v, 1); });
    $("z2Fly").innerHTML = nf(L.inFlight) + ' <small style="font-size:12px;color:var(--dim)">' + esc(t("txs")) + "</small>";
  }
  function renderZ3() {
    var f = S.feed[0];
    if (f) {
      $("feat").className = "feat" + (f._new ? " new" : "");
      $("feat").innerHTML = '<div class="fl"><div class="fr1"><span class="lt">' + esc(t("latest")) + "</span>" + esc(city(f.from)) + ' <span style="color:var(--dim)">→</span> ' + esc(city(f.to)) + '</div><div class="fr2">' + f.from + "·" + f.to + ' · <a href="' + txUrl(f.tx, f.block) + '" target="_blank" rel="noopener">' + esc(shortHash(f.tx)) + '</a> · <a href="' + blkUrl(f.block) + '" target="_blank" rel="noopener">#' + nf(f.block) + "</a> · " + ago(f.ts) + '</div></div><div class="fa">$' + nf(f.amount, 2) + "</div>";
    }
    loopFeed.set(S.feed.slice(1).map(function (r, i) { return rowHtml(r, "feed", i); }).join(""));
  }
  function renderZ4() {
    var c = S.commitment;
    $("z4Algo").textContent = c.algo || "keccak256";
    $("z4Root").textContent = c.root;
    tween($("z4Orders"), c.ordersCommitted, function (v) { return nf(v); });
    $("z4Blk").textContent = "#" + nf(c.anchorBlock);
    $("z4Verify").href = txUrl(c.root, c.anchorBlock);
  }
  function renderZ5() {
    var f = S.settlementFlow;
    $("z5Contract").textContent = shortHash(f.contract);
    tween($("z5In"), f.fundsIn, function (v) { return "$" + nf(v, 2); });
    tween($("z5Out"), f.netRelease, function (v) { return "$" + nf(v, 2); });
    $("z5Res").textContent = "$" + nf(f.reserve, f.reserve % 1 ? 2 : 0);
  }
  function renderZ6() {
    var R = S.routes.slice(0, 5), max = Math.max.apply(null, R.map(function (r) { return r.amount; }));
    var el = $("bars");
    if (el.children.length !== R.length) el.innerHTML = R.map(function () { return '<div class="bar6"><span class="bn"></span><div class="bm"><div class="bt"><span class="nm"></span><span class="codes"></span></div><div class="track"><i class="fill" style="width:0"></i></div></div><div class="bv"><b></b><span></span></div></div>'; }).join("");
    R.forEach(function (r, i) {
      var b = el.children[i];
      b.querySelector(".bn").textContent = i + 1;
      b.querySelector(".nm").textContent = city(r.from) + " → " + city(r.to);
      b.querySelector(".codes").textContent = r.from + "·" + r.to;
      b.querySelector(".bv b").textContent = short(r.amount, 2);
      b.querySelector(".bv span").textContent = r.orders + " " + t("orders");
      var fill = b.querySelector(".fill");
      requestAnimationFrame(function () { fill.style.width = (r.amount / max * 100).toFixed(1) + "%"; });
    });
    var m = S.metrics;
    tween($("m_cum"), m.cumulative, function (v) { return short(v, 2); });
    $("m_avg").textContent = "~" + m.avgSettleSec + "s";
    tween($("m_routes"), m.settledRoutes, function (v) { return nf(v); });
    $("m_ref").textContent = (m.refundRate * 100).toFixed(m.refundRate ? 1 : 0) + "%";
  }
  var DCOL = ["#e4e9ed", "#9fb2c4", "#7d8a96", "#5f6b76", "#b9c2ca", "#4a545e", "#8a98a6"];
  function renderZ7() {
    var D = S.destinations, tot = D.reduce(function (a, d) { return a + d.share; }, 0);
    var minA = 2.2, a0 = -90, svg = "";
    svg += '<circle r="104" fill="none" stroke="rgba(196,206,216,.18)" stroke-dasharray="2 4"/>';
    svg += '<g class="spin7"><circle r="96" fill="none" stroke="rgba(220,228,236,.35)" stroke-width="1" stroke-dasharray="40 260 12 300"/></g>';
    var big = 360 - D.length * 1.4, spans = D.map(function (d) { return Math.max(minA, d.share / tot * 360); });
    var sum = spans.reduce(function (a, b) { return a + b; }, 0), k = big / sum;
    D.forEach(function (d, i) {
      var s = spans[i] * k, a1 = a0 + s;
      svg += '<path data-i="' + i + '" d="' + arc(0, 0, 84, 62, a0, a1) + '" fill="' + DCOL[i % DCOL.length] + '" fill-opacity="' + (i === 0 ? .92 : .85) + '"/>';
      a0 = a1 + 1.4;
    });
    svg += '<circle r="56" fill="none" stroke="rgba(196,206,216,.2)"/>';
    for (var j = 0; j < 60; j++) { var an = j * 6 * Math.PI / 180, r1 = 89, r2 = j % 5 ? 91 : 94; svg += '<line x1="' + (Math.cos(an) * r1).toFixed(1) + '" y1="' + (Math.sin(an) * r1).toFixed(1) + '" x2="' + (Math.cos(an) * r2).toFixed(1) + '" y2="' + (Math.sin(an) * r2).toFixed(1) + '" stroke="rgba(220,228,236,.35)"/>'; }
    svg += '<text id="d7v" y="2" text-anchor="middle" fill="#c9a36a" font-family="Share Tech Mono" font-size="26">' + D[0].share + '%</text><text id="d7l" y="22" text-anchor="middle" fill="#8b949c" font-size="11" letter-spacing="1">' + esc(t(D[0].key)).toUpperCase() + "</text>";
    $("donut").innerHTML = svg;
    $("legend7").innerHTML = D.map(function (d, i) { return '<div class="lg7" data-i="' + i + '"><i style="background:' + DCOL[i % DCOL.length] + '"></i><span>' + esc(t(d.key)) + "</span><b>" + d.share.toFixed(1) + "%</b></div>"; }).join("");
  }
  function arc(cx, cy, R, r, a0, a1) {
    function p(rad, a) { a = a * Math.PI / 180; return (cx + rad * Math.cos(a)).toFixed(2) + " " + (cy + rad * Math.sin(a)).toFixed(2); }
    var L = a1 - a0 > 180 ? 1 : 0;
    return "M" + p(R, a0) + " A" + R + " " + R + " 0 " + L + " 1 " + p(R, a1) + " L" + p(r, a1) + " A" + r + " " + r + " 0 " + L + " 0 " + p(r, a0) + "Z";
  }
  function hoverD(i) {
    var D = S.destinations, d = D[i == null ? 0 : i];
    document.querySelectorAll(".lg7").forEach(function (e) { e.classList.toggle("hov", +e.dataset.i === i); });
    document.querySelectorAll("#donut path").forEach(function (p) { p.style.opacity = i == null || +p.dataset.i === i ? 1 : .35; });
    $("d7v").textContent = d.share + "%"; $("d7l").textContent = t(d.key).toUpperCase();
  }
  $("legend7").addEventListener("mouseover", function (e) { var r = e.target.closest(".lg7"); if (r) hoverD(+r.dataset.i); });
  $("legend7").addEventListener("mouseleave", function () { hoverD(null); });
  $("donut").addEventListener("mouseover", function (e) { var p = e.target.closest("path[data-i]"); if (p) hoverD(+p.dataset.i); });
  $("donut").addEventListener("mouseleave", function () { hoverD(null); });

  function renderCenter() {
    reel($("roBlock"), nf(S.meta.block));
    reel($("roToday"), nf(S.liquidity.todayTotal, 2));
    reel($("roTime"), (S.metrics.liveSettleSec || S.metrics.avgSettleSec).toFixed(2));
    var codes = hubCodes();
    $("cHubs").textContent = codes.length;
    var active = codes.filter(function (c) { return hubInfo(c).routes.some(function (r) { return !r.net; }); }).length;
    var cov = codes.length ? active / codes.length * 100 : 0;
    $("cCov").textContent = cov.toFixed(2);
    $("cCovBar").style.width = cov.toFixed(1) + "%";
    $("cArcs").textContent = allArcs().length;
    $("hdrNet").textContent = (S.meta.network || "").toUpperCase();
    $("hdrBlock").textContent = nf(S.meta.block);
  }

  function renderAll(langOnly) {
    renderZ1(); renderZ2(); renderZ3(); renderZ4(); renderZ5(); renderZ6(); renderZ7(); renderCenter(); renderLive();
    if (popCode) renderPop();
    S.feed.forEach(function (r) { r._new = false; }); S.supplyChain.ticker.forEach(function (r) { r._new = false; });
  }
  function renderLive() {
    var b = $("liveBadge");
    b.classList.toggle("sim", mode !== "live");
    $("liveMode").textContent = mode === "live" ? t("live") : t("simulated");
    if (lastSync) $("liveTime").textContent = new Intl.DateTimeFormat("en-GB", { timeZone: S.meta.timezone || "Asia/Shanghai", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(lastSync);
  }
  function synced() {
    lastSync = new Date(); renderLive();
    var b = $("liveBadge"); b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
  }

  /* ---------------- globe data helpers (shared with globe.js) ---------------- */
  function allArcs() {
    var seen = {}, out = [];
    function add(a, b, net, amt) { if (!S.airports[a] || !S.airports[b] || a === b) return; var k = a < b ? a + b : b + a; if (seen[k]) { if (!net) seen[k].net = false; return; } seen[k] = { a: a, b: b, net: net }; out.push(seen[k]); }
    S.routes.forEach(function (r) { add(r.from, r.to, false); });
    S.feed.forEach(function (r) { add(r.from, r.to, false); });
    S.supplyChain.ticker.forEach(function (r) { add(r.from, r.to, false); });
    (S.networkRoutes || []).forEach(function (r) { add(r[0], r[1], true); });
    return out;
  }
  function hubCodes() { return Object.keys(S.airports); }
  function hubInfo(code) {
    var routes = {}, total = 0;
    function add(r, src) {
      if (r.from !== code && r.to !== code) return;
      var k = r.from + ">" + r.to; var o = routes[k] || (routes[k] = { from: r.from, to: r.to, amount: 0, orders: 0, net: false });
      if (src === "route") { o.amount += r.amount; o.orders += r.orders; total += r.amount; }
      else { o.amount += r.amount; o.orders += 1; total += r.amount; }
    }
    S.routes.forEach(function (r) { add(r, "route"); });
    S.feed.forEach(function (r) { add(r, "feed"); });
    (S.networkRoutes || []).forEach(function (p) { if (p[0] === code || p[1] === code) { var k = p[0] + ">" + p[1]; if (!routes[k] && !routes[p[1] + ">" + p[0]]) routes[k] = { from: p[0], to: p[1], amount: 0, orders: 0, net: true }; } });
    var ext = (S.hubs || {})[code] || {};
    var list = Object.keys(routes).map(function (k) { return routes[k]; }).sort(function (a, b) { return b.amount - a.amount; });
    return { code: code, routes: list, today: ext.todaySettlement != null ? ext.todaySettlement : total, airlines: ext.airlines || null };
  }

  /* ---------------- hub popover ---------------- */
  var popCode = null;
  function renderPop() {
    var a = S.airports[popCode]; if (!a) return closePop();
    var h = hubInfo(popCode);
    var rows = h.routes.slice(0, 5).map(function (r) {
      return '<div class="pp-r"><span>' + esc(city(r.from)) + " → " + esc(city(r.to)) + ' <span class="mono">' + r.from + "·" + r.to + '</span></span><span class="mono ' + (r.net ? "" : "g") + '">' + (r.net ? "NET" : "$" + short(r.amount, 2)) + "</span></div>";
    }).join("") || '<div class="pp-r"><span>' + esc(t("noRoutes")) + "</span></div>";
    $("pop").innerHTML = '<div class="pp-h"><b>' + popCode + "</b><span>" + esc(city(popCode)) + '</span><button class="pp-x" aria-label="' + esc(t("close")) + '">×</button></div><div class="pp-b"><div class="pp-k">' + esc(t("hubToday")) + '</div><div class="pp-amt">$' + nf(h.today, 2) + ' <small style="font-size:11px;color:var(--dim)">USDC</small></div><div class="pp-k">' + esc(t("hubRoutes")) + " · " + h.routes.length + "</div>" + rows + '<div class="pp-k">' + esc(t("hubAirlines")) + '</div><div style="font-size:12px;color:' + (h.airlines ? "var(--fg)" : "var(--dim)") + '">' + esc(h.airlines ? h.airlines.join(" · ") : t("pendingApi")) + '</div><div class="pp-ll">' + Math.abs(a.lat).toFixed(2) + (a.lat >= 0 ? "N " : "S ") + Math.abs(a.lon).toFixed(2) + (a.lon >= 0 ? "E" : "W") + "</div></div>";
    $("pop").querySelector(".pp-x").onclick = closePop;
  }
  function openHub(code, x, y) {
    popCode = code; var p = $("pop"); p.hidden = false; renderPop();
    var W = $("globeWrap").clientWidth, H = $("globeWrap").clientHeight, pw = 250, ph = p.offsetHeight;
    var left = x + 18, top = y - 30;
    if (left + pw > W - 6) left = x - pw - 18;
    top = Math.max(6, Math.min(H - ph - 6, top));
    p.style.left = left + "px"; p.style.top = top + "px";
    var a = S.airports[code]; $("cLL").textContent = Math.abs(a.lat).toFixed(2) + (a.lat >= 0 ? "N " : "S ") + Math.abs(a.lon).toFixed(2) + (a.lon >= 0 ? "E" : "W");
    emit("hub", code);
  }
  function closePop() { popCode = null; $("pop").hidden = true; emit("hub", null); }
  addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });

  /* ---------------- query box ---------------- */
  $("q2in").addEventListener("input", function () { this._dirty = true; });
  $("q2").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("q2in").value.trim().replace(/^0x/i, "");
    var url;
    if (/^\d+$/.test(v)) url = blkUrl(v);
    else if (/^[0-9a-f]{64}$/i.test(v)) url = EXP() + "/tx/0x" + v;
    else if (/^[0-9a-f]{40}$/i.test(v)) url = EXP() + "/address/0x" + v;
    else url = EXP() + "/search?f=0&q=" + encodeURIComponent(v);
    window.open(url, "_blank", "noopener");
  });

  /* ---------------- simulation ---------------- */
  var POOL = [["PVG","XIY"],["CTU","PVG"],["KWE","JHG"],["URC","XIY"],["ICN","SZX"],["SZX","ICN"],["VKO","LED"],["KUL","CGK"],["PKX","SVO"],["CGK","CAN"],["CAN","CGK"],["XIY","PVG"],["PVG","CTU"],["SVO","PKX"]];
  function simSettle() {
    var p = POOL[Math.random() * POOL.length | 0];
    var amt = Math.round((55 + Math.random() * 120) * 100) / 100;
    var full = "0x" + randHex(64);
    var row = { from: p[0], to: p[1], amount: amt, tx: full.slice(0, 6) + "…" + full.slice(-4), block: S.meta.block, ts: Date.now(), _new: true };
    S.feed.unshift(row); S.feed.length = Math.min(S.feed.length, 14);
    S.supplyChain.ticker.unshift(Object.assign({}, row, { amount: Math.round(amt) })); S.supplyChain.ticker.length = Math.min(S.supplyChain.ticker.length, 10);
    S.supplyChain.today.amount += amt; S.supplyChain.today.tickets += 1;
    S.liquidity.todayTotal = Math.round((S.liquidity.todayTotal + amt) * 100) / 100;
    S.liquidity.settledTickets += 1; S.liquidity.lastSettlementMin = 0;
    S.liquidity.inFlight = Math.max(3, Math.min(30, S.liquidity.inFlight + (Math.random() * 5 | 0) - 2));
    S.commitment.ordersCommitted += 1;
    S.settlementFlow.fundsIn = Math.round((S.settlementFlow.fundsIn + amt) * 100) / 100;
    S.settlementFlow.netRelease = Math.round((S.settlementFlow.netRelease + amt * (0.97 + Math.random() * .03)) * 100) / 100;
    S.metrics.cumulative += amt;
    S.metrics.liveSettleSec = 1.7 + Math.random() * 0.6;
    S.routes.forEach(function (r) { if (r.from === p[0] && r.to === p[1]) { r.amount += amt; r.orders += 1; } });
    flowStep = (flowStep + 1) % 5;
    renderAll(); synced();
    emit("settle", { from: p[0], to: p[1], amount: amt });
  }
  function simBlock() { S.meta.block += 1; reel($("roBlock"), nf(S.meta.block)); $("hdrBlock").textContent = nf(S.meta.block); $("z2Blk").textContent = nf(S.meta.block); }

  var simT = null, blkT = null;
  function startSim() {
    if (simT || CFG.simulate === false) return;
    simT = setInterval(simSettle, REDUCED ? 8000 : 3600);
    blkT = setInterval(simBlock, 2000);
  }
  function stopSim() { clearInterval(simT); clearInterval(blkT); simT = blkT = null; }

  /* ---------------- live API ---------------- */
  function merge(snap) {
    if (!snap || typeof snap !== "object") throw new Error("bad snapshot");
    var prevTop = S.feed[0] && S.feed[0].tx;
    ["meta","supplyChain","liquidity","commitment","settlementFlow","metrics"].forEach(function (k) { if (snap[k]) S[k] = Object.assign({}, S[k], snap[k]); });
    ["feed","routes","destinations","networkRoutes"].forEach(function (k) { if (Array.isArray(snap[k])) S[k] = snap[k]; });
    if (snap.airports) S.airports = Object.assign({}, S.airports, snap.airports);
    if (snap.hubs) S.hubs = snap.hubs;
    if (snap.supplyChain && snap.supplyChain.kpis) S.supplyChain.kpis = Object.assign({}, window.DFLY_SEED.supplyChain.kpis, snap.supplyChain.kpis);
    stampRows(S.feed); stampRows(S.supplyChain.ticker);
    if (S.feed[0] && S.feed[0].tx !== prevTop) { S.feed[0]._new = true; emit("settle", S.feed[0]); }
  }
  function poll() {
    fetch(API, { cache: "no-store", headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { merge(j); if (mode !== "live") { mode = "live"; stopSim(); } renderAll(); synced(); emit("data"); })
      .catch(function (e) { mode = "sim"; startSim(); renderLive(); console.warn("[dfly] API unavailable, simulating:", e.message); })
      .finally(function () { setTimeout(poll, POLL); });
  }
  // optional SSE hook: server pushes full or partial snapshots as `data:` JSON lines
  function stream(url) {
    try { var es = new EventSource(url); es.onmessage = function (ev) { try { merge(JSON.parse(ev.data)); mode = "live"; stopSim(); renderAll(); synced(); emit("data"); } catch (e) {} }; } catch (e) {}
  }

  /* ---------------- boot ---------------- */
  window.DFLY = { state: function () { return S; }, t: t, city: city, lang: function () { return lang; }, bus: bus, allArcs: allArcs, hubInfo: hubInfo, openHub: openHub, closePop: closePop, popCode: function () { return popCode; }, reduced: REDUCED };
  document.querySelectorAll("#tabs button").forEach(function (b) {
    b.addEventListener("click", function () { document.querySelectorAll("#tabs button").forEach(function (x) { x.classList.toggle("on", x === b); }); emit("region", b.dataset.r); });
  });
  applyLang(); tickClock(); setInterval(tickClock, 1000);
  setInterval(function () { // age labels advance
    if (!REDUCED) { S.liquidity.lastSettlementMin = Math.floor((Date.now() - (S.feed[0] ? S.feed[0].ts : Date.now())) / 60000); $("z2Last").textContent = S.liquidity.lastSettlementMin; }
    document.querySelectorAll(".age").forEach(function () {}); renderZ1Ages();
  }, 30000);
  function renderZ1Ages() { loopTicker.set(S.supplyChain.ticker.map(function (r) { return rowHtml(r, "ticker"); }).join("")); renderZ3(); }
  synced();
  if (API) { poll(); if (CFG.stream) stream(CFG.stream); } else startSim();
  if (!API) renderLive();
})();

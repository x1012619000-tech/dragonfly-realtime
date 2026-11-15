/* Dragonfly Real-time data — zone 8: 3D globe (three.js, vendored). */
import * as THREE from "../vendor/three.module.js";

const D = window.DFLY;
const wrap = document.getElementById("globeWrap");
const canvas = document.getElementById("globe");
const layer = document.getElementById("hubLayer");
const ringsSvg = document.getElementById("rings");
const DEG = Math.PI / 180;
const REDUCED = D.reduced;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
} catch (e) {
  console.warn("[dfly] WebGL unavailable", e);
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const globe = new THREE.Group();
scene.add(globe);

function v3(lat, lon, r = 1) {
  const la = lat * DEG, lo = lon * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

/* ---------- photoreal monochrome Earth (NASA Blue Marble derived, greyscale) ---------- */
const texLoader = new THREE.TextureLoader();
const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
function tex(url, srgb) { const t = texLoader.load(url, () => { t.needsUpdate = true; }); t.anisotropy = Math.min(8, maxAniso); t.wrapS = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.NoColorSpace; return t; }
const earthU = {
  uMap: { value: tex("tex/earth-mono.jpg") },
  uWater: { value: tex("tex/earth-water.jpg") },
  uBump: { value: tex("tex/earth-bump.jpg") },
  uLight: { value: new THREE.Vector3(-0.78, 0.5, 0.36).normalize() },
  uReady: { value: 0 }
};
const core = new THREE.Mesh(
  new THREE.SphereGeometry(1, 128, 96),
  new THREE.ShaderMaterial({
    uniforms: earthU,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform sampler2D uWater; uniform sampler2D uBump; uniform vec3 uLight; uniform float uReady;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec2 uv = vec2(vUv.x + 0.25, vUv.y);
        float alb = texture2D(uMap, uv).r;
        float water = texture2D(uWater, uv).r;
        // cheap bump from topology
        vec2 px = vec2(1.0/2048.0, 1.0/1024.0);
        float h0 = texture2D(uBump, uv).r, hx = texture2D(uBump, uv + vec2(px.x,0.)).r, hy = texture2D(uBump, uv + vec2(0.,px.y)).r;
        vec3 N = normalize(vN + vec3(h0-hx, h0-hy, 0.0) * 1.6 * (1.0 - water));
        float lam = dot(N, uLight);
        float day = smoothstep(-0.25, 0.75, lam);
        vec3 col = vec3(alb) * (0.035 + 1.22 * day * day * (3.0 - 2.0*day));
        // specular glint on oceans
        vec3 R = reflect(-uLight, N);
        float spec = pow(max(dot(R, vV), 0.0), 38.0) * water * 0.55 * day;
        col += vec3(spec);
        // terminator soft cold band + rim light on lit limb
        float f = 1.0 - max(dot(vN, vV), 0.0);
        col += vec3(0.62,0.70,0.80) * pow(f, 2.6) * (0.25 + 0.75*smoothstep(-0.2, 0.7, dot(vN, uLight))) * 0.9;
        col *= vec3(0.94, 0.975, 1.02);
        col = mix(vec3(0.03,0.035,0.04), col, uReady);
        gl_FragColor = vec4(col, 1.0);
      }`
  })
);
globe.add(core);
{ const t0 = performance.now(); const fade = () => { earthU.uReady.value = Math.min(1, (performance.now() - t0) / 1400); if (earthU.uReady.value < 1) requestAnimationFrame(fade); }; THREE.DefaultLoadingManager.onLoad = () => requestAnimationFrame(fade); setTimeout(() => { if (!earthU.uReady.value) requestAnimationFrame(fade); }, 6000); }

/* ---------- atmosphere glow ---------- */
const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(1.16, 64, 48),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float d = dot(vN, vV); float i = pow(clamp(1.0 + d*1.25, 0.0, 1.0), 2.6) * 0.6; gl_FragColor = vec4(vec3(0.66,0.75,0.86)*i, i); }`
  })
);
scene.add(atmo);

/* ---------- graticule ---------- */
function graticule() {
  const minor = [], major = [];
  for (let lat = -80; lat <= 80; lat += 10) {
    const arr = lat % 30 === 0 ? major : minor;
    for (let lon = -180; lon < 180; lon += 2) arr.push(v3(lat, lon, 1.0015), v3(lat, lon + 2, 1.0015));
  }
  for (let lon = -180; lon < 180; lon += 10) {
    const arr = lon % 30 === 0 ? major : minor;
    for (let lat = -88; lat < 88; lat += 2) arr.push(v3(lat, lon, 1.0015), v3(lat + 2, lon, 1.0015));
  }
  const mk = (pts, op) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9aa6b2, transparent: true, opacity: op, depthWrite: false }));
  globe.add(mk(minor, 0.07), mk(major, 0.16));
  // equator brighter dashed
  const eq = []; for (let lon = -180; lon < 180; lon += 3) eq.push(v3(0, lon, 1.003), v3(0, lon + 1.6, 1.003));
  globe.add(mk(eq, 0.32));
}
graticule();

/* ---------- land ---------- */
fetch("data/world.json").then(r => r.json()).then(w => {
  const segs = (lines, r) => { const p = []; for (const l of lines) for (let i = 0; i + 3 < l.length; i += 2) p.push(v3(l[i + 1], l[i], r), v3(l[i + 3], l[i + 2], r)); return p; };
  const coast = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs(w.coast, 1.003)), new THREE.LineBasicMaterial({ color: 0xe4e9ee, transparent: true, opacity: 0.26 }));
  const borders = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs(w.borders, 1.0025)), new THREE.LineBasicMaterial({ color: 0xaab4be, transparent: true, opacity: 0.07 }));
  globe.add(borders, coast);
}).catch(e => console.warn("[dfly] world data", e));

/* ---------- orbital ellipses (scene space, beyond the globe) ---------- */
const orbits = new THREE.Group(); scene.add(orbits);
[[1.34, 72, 8, 0.20, false], [1.62, 64, -18, 0.13, true], [2.05, 80, 30, 0.08, true]].forEach(([r, tx, tz, op, dash]) => {
  const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = dash ? new THREE.LineDashedMaterial({ color: 0xcfd8e2, transparent: true, opacity: op, dashSize: 0.03, gapSize: 0.025, depthWrite: false })
                 : new THREE.LineBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: op, depthWrite: false });
  const l = new THREE.Line(g, m); if (dash) l.computeLineDistances();
  l.rotation.set(tx * DEG, 0, tz * DEG); orbits.add(l);
  // a satellite blip on each orbit
  const sat = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  sat.userData = { r, ph: Math.random() * 6.28, sp: 0.05 + Math.random() * 0.05 }; l.add(sat); l.userData.sat = sat;
});
/* faint extended lat/long shell, partially visible beyond the limb */
{
  const pts = [], R = 1.22;
  for (let lat = 0; lat <= 70; lat += 10) for (let lon = -70; lon < 10; lon += 2) pts.push(v3(lat, lon, R), v3(lat, lon + 2, R));
  for (let lon = -70; lon <= 10; lon += 10) for (let lat = 0; lat < 70; lat += 2) pts.push(v3(lat, lon, R), v3(lat + 2, lon, R));
  const shell = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xc9d3dd, transparent: true, opacity: 0.075, depthWrite: false }));
  shell.rotation.set(0.15, 0.3, 0.2); orbits.add(shell);
}
/* translucent surface data patches (IMG3-style overlays) */
function patch(la0, la1, lo0, lo1) {
  const g = new THREE.BufferGeometry(), pos = [], idx = [], N = 10;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const v = v3(la0 + (la1 - la0) * i / N, lo0 + (lo1 - lo0) * j / N, 1.012); pos.push(v.x, v.y, v.z); }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j; idx.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  globe.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })));
  const e = []; for (let j = 0; j <= N; j++) e.push(v3(la0, lo0 + (lo1 - lo0) * j / N, 1.013)); for (let i = 0; i <= N; i++) e.push(v3(la0 + (la1 - la0) * i / N, lo1, 1.013));
  for (let j = N; j >= 0; j--) e.push(v3(la1, lo0 + (lo1 - lo0) * j / N, 1.013)); for (let i = N; i >= 0; i--) e.push(v3(la0 + (la1 - la0) * i / N, lo0, 1.013));
  globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(e), new THREE.LineBasicMaterial({ color: 0xe8edf2, transparent: true, opacity: 0.32, depthWrite: false })));
}
patch(36, 48, 70, 90); patch(-8, 6, 96, 112); patch(50, 60, 22, 40);

/* ---------- soft sprite ---------- */
function spriteTex() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(235,242,248,.85)"); gr.addColorStop(1, "rgba(200,215,230,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const SPR = spriteTex();

/* ---------- arcs ---------- */
const shared = { uTime: { value: 0 } };
const arcVS = `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const arcFS = `uniform float uTime; uniform float uSeed; uniform float uSpeed; uniform float uNet; uniform float uBoost; uniform float uStatic; varying float vT;
  void main(){
    float base = mix(0.34, 0.14, uNet);
    if (uNet > 0.5) base *= step(0.45, fract(vT*60.0));
    float head = fract(uTime*uSpeed + uSeed);
    float d = head - vT; if (d < 0.0) d += 1.0;
    float tail = mix(0.22, 0.12, uNet);
    float glow = (1.0 - smoothstep(0.0, tail, d)) * (1.0 - uStatic);
    float a = base + glow*mix(0.95, 0.5, uNet) + uBoost*0.7;
    vec3 col = mix(vec3(0.80,0.85,0.90), vec3(1.0), glow);
    col = mix(col, vec3(0.86,0.72,0.50), uBoost*0.6);
    float edge = smoothstep(0.0, 0.04, vT) * smoothstep(1.0, 0.96, vT);
    gl_FragColor = vec4(col, a*edge);
  }`;
let arcs = [];
const arcGroup = new THREE.Group(); globe.add(arcGroup);
const heads = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: SPR, size: 9, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }));
globe.add(heads);

function buildArcs() {
  arcGroup.clear(); arcs = [];
  const S = D.state();
  D.allArcs().forEach((r, i) => {
    const A = S.airports[r.a], B = S.airports[r.b];
    const va = v3(A.lat, A.lon), vb = v3(B.lat, B.lon);
    const ang = va.angleTo(vb);
    const h = 0.04 + ang * 0.22;
    const N = 72, pts = [], ts = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const p = new THREE.Vector3().copy(va).lerp(vb, t).normalize();
      // proper slerp
      const s = Math.sin(ang); if (s > 1e-4) p.copy(va).multiplyScalar(Math.sin((1 - t) * ang) / s).add(vb.clone().multiplyScalar(Math.sin(t * ang) / s));
      p.multiplyScalar(1.004 + Math.sin(Math.PI * t) * h);
      pts.push(p); ts.push(t);
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts); g.setAttribute("aT", new THREE.Float32BufferAttribute(ts, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uSeed: { value: (i * 0.137) % 1 }, uSpeed: { value: (r.net ? 0.1 : 0.22) * (0.8 + ((i * 7) % 5) / 10) }, uNet: { value: r.net ? 1 : 0 }, uBoost: { value: 0 }, uStatic: { value: REDUCED ? 1 : 0 } },
      vertexShader: arcVS, fragmentShader: arcFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(g, m); arcGroup.add(line);
    arcs.push({ a: r.a, b: r.b, net: r.net, pts, mat: m });
  });
  heads.geometry.dispose();
  const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(arcs.length * 3), 3));
  heads.geometry = hg;
  heads.visible = !REDUCED;
}

/* ---------- hubs (HTML reticles) ---------- */
let hubs = [];
const CHEV = `<svg class="cv" viewBox="0 0 10 10" width="9" height="9"><path d="M1.5 3.2 5 6.8 8.5 3.2" fill="none" stroke="#d2a35c" stroke-width="1.8"/></svg>`;
const RET_HERO = `<svg class="r-hero" viewBox="-24 -24 48 48"><g class="sp1"><circle r="16" fill="none" stroke="rgba(240,244,248,.7)" stroke-width="1" stroke-dasharray="2.6 3.4"/></g><g class="sp2"><path d="M-20 -6A21 21 0 0 1 -6 -20M6 20A21 21 0 0 1 20 6" fill="none" stroke="rgba(240,244,248,.85)" stroke-width="1.4"/></g><circle r="10.5" fill="none" stroke="#f4f6f8" stroke-width="3.4"/><circle r="7" fill="#0c0d0f"/><circle r="4.2" fill="#d6a457"/><circle class="pg" r="10.5" fill="none" stroke="#fff" stroke-width="1.2"/></svg>`;
const RET_DOT = `<svg class="r-dot" viewBox="-11 -11 22 22"><circle r="5" fill="none" stroke="rgba(235,240,245,.65)" stroke-width=".9"/><circle r="2.1" fill="#f1f4f6"/><circle class="pg" r="5" fill="none" stroke="#fff" stroke-width="1"/></svg>`;
const style = document.createElement("style");
style.textContent = `.hub{width:22px;height:22px}
.hub .r-hero{display:none;position:absolute;left:-19px;top:-19px;width:60px;height:60px;overflow:visible;filter:drop-shadow(0 0 6px rgba(240,245,250,.75)) drop-shadow(0 0 16px rgba(220,230,240,.35))}
.hub .r-dot{width:22px;height:22px;filter:drop-shadow(0 0 3px rgba(255,255,255,.7))}
.hub.hero .r-hero,.hub.sel .r-hero{display:block}.hub.hero .r-dot,.hub.sel .r-dot{display:none}
.hub::before{content:"";position:absolute;left:50%;top:50%;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;background:radial-gradient(circle,rgba(235,242,248,.28),rgba(235,242,248,0) 65%);display:none;pointer-events:none}
.hub.hero::before,.hub.sel::before{display:block}
.r-hero .sp1{animation:hsp 9s linear infinite}.r-hero .sp2{animation:hsp 5s linear infinite reverse}@keyframes hsp{to{transform:rotate(360deg)}}
.hub .pg{opacity:0;transform-origin:center}.hub.ping .pg{animation:hp 1.4s ease-out}@keyframes hp{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.8)}}
.hub .lb{position:absolute;left:17px;top:-12px;display:flex;align-items:center;gap:4px;height:17px;padding:0 9px 0 4px;background:linear-gradient(90deg,rgba(12,13,15,.94),rgba(26,28,31,.82));border:1px solid rgba(210,216,222,.16);border-left:2px solid rgba(214,164,87,.85);font-family:'Chakra Petch','Rajdhani',sans-serif;font-weight:600;font-size:10.5px;letter-spacing:.09em;color:#eef1f3;text-transform:uppercase;white-space:nowrap;text-shadow:none;box-shadow:0 2px 8px rgba(0,0,0,.6)}
.hub .lb em{font-style:normal;color:#8d969e;font-weight:500;margin-left:3px;letter-spacing:.06em}
.hub.hero .lb,.hub.sel .lb{left:32px;top:-16px}
.hub.nolab .lb{display:none!important}.hub.nolab:hover .lb{display:flex!important}
.hub.minor .lb{display:none}.hub.sel .lb{display:flex!important}`;
document.head.appendChild(style);

function heroSet() {
  const S = D.state();
  return new Set(Object.keys(S.airports).filter(c => !S.airports[c].minor).map(c => [c, D.hubInfo(c).today]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]));
}
function buildHubs() {
  layer.innerHTML = ""; hubs = [];
  const S = D.state();
  const active = new Set(); D.allArcs().forEach(r => { if (!r.net) { active.add(r.a); active.add(r.b); } });
  const heroes = heroSet();
  Object.keys(S.airports).forEach(code => {
    const a = S.airports[code];
    const el = document.createElement("div");
    const isNet = !active.has(code);
    el.className = "hub " + (isNet ? "net" : "major") + (a.minor ? " minor" : "") + (heroes.has(code) ? " hero" : "");
    el.innerHTML = RET_HERO + RET_DOT + `<span class="lb">${CHEV}<span class="cn">${D.city(code)}</span><em>${code}</em></span>`;
    el.addEventListener("click", ev => { ev.stopPropagation(); select(code); });
    el.addEventListener("pointerdown", ev => ev.stopPropagation());
    layer.appendChild(el);
    hubs.push({ code, el, pri: (heroes.has(code) ? -1 : 0) + (isNet ? 2 : 0) + (a.minor ? 1 : 0), pos: v3(a.lat, a.lon, 1.006), lb: el.querySelector(".lb .cn") });
  });
  hubs.sort((x, y) => x.pri - y.pri);
}
function relabel() { hubs.forEach(h => { h.lb.textContent = D.city(h.code); }); }

let selected = null;
function select(code) {
  selected = code;
  hubs.forEach(h => h.el.classList.toggle("sel", h.code === code));
  const h = hubs.find(x => x.code === code);
  const p = project(h.pos);
  D.openHub(code, p.x, p.y);
  arcs.forEach(a => { a.mat.uniforms.uBoost.value = (a.a === code || a.b === code) ? 0.55 : 0; });
}

/* ---------- interaction ---------- */
let rotY = -105 * DEG, rotX = 24 * DEG, velY = 0, velX = 0;
let target = null, idleAt = 0, dragging = false, last = null, moved = 0, region = "global";
canvas.addEventListener("pointerdown", e => { dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY }; target = null; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", e => {
  if (!dragging) return;
  const s = window.DFLY_SCALE || 1;
  const dx = (e.clientX - last.x) / s, dy = (e.clientY - last.y) / s; last = { x: e.clientX, y: e.clientY };
  moved += Math.abs(dx) + Math.abs(dy);
  velY = dx * 0.0042; velX = dy * 0.0042;
  rotY += velY; rotX = Math.max(-0.9, Math.min(1.25, rotX + velX));
});
const endDrag = () => { if (!dragging) return; dragging = false; idleAt = performance.now(); if (moved < 4) { D.closePop(); } };
canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);

const REG = { global: null, asia: [112, 22], eurasia: [72, 44], west: [-35, 42] };
D.bus.addEventListener("region", e => {
  region = e.detail; D.closePop();
  const r = REG[region];
  if (r) {
    let ty = -r[0] * DEG; while (ty - rotY > Math.PI) ty -= 2 * Math.PI; while (rotY - ty > Math.PI) ty += 2 * Math.PI;
    target = { y: ty, x: r[1] * DEG };
  } else { target = { y: rotY, x: 24 * DEG }; }
  velX = velY = 0;
});
D.bus.addEventListener("hub", e => { if (!e.detail) { selected = null; hubs.forEach(h => h.el.classList.remove("sel")); arcs.forEach(a => a.mat.uniforms.uBoost.value = 0); } });
D.bus.addEventListener("settle", e => {
  const { from, to } = e.detail;
  const a = arcs.find(x => (x.a === from && x.b === to) || (x.a === to && x.b === from));
  if (a) { a.mat.uniforms.uBoost.value = 1; a.flash = 1; }
  hubs.forEach(h => { if (h.code === to || h.code === from) { h.el.classList.remove("ping"); void h.el.offsetWidth; h.el.classList.add("ping"); } });
});
D.bus.addEventListener("lang", relabel);
D.bus.addEventListener("data", () => { buildArcs(); buildHubs(); });
D.bus.addEventListener("resize", resize);

/* ---------- HUD rings (SVG) ---------- */
let RPX = 285;
function buildRings() {
  const R = RPX;
  let s = "";
  const c = (r, attrs) => `<circle r="${r}" fill="none" ${attrs}/>`;
  s += c(R + 12, `stroke="rgba(220,228,236,.22)"`);
  s += c(R + 30, `stroke="rgba(220,228,236,.10)" stroke-dasharray="1 5"`);
  // tick ring
  let ticks = "";
  for (let i = 0; i < 360; i += 2) {
    const a = i * DEG, r1 = R + 44, r2 = R + (i % 30 === 0 ? 56 : i % 10 === 0 ? 51 : 47);
    ticks += `<line x1="${(Math.cos(a) * r1).toFixed(1)}" y1="${(Math.sin(a) * r1).toFixed(1)}" x2="${(Math.cos(a) * r2).toFixed(1)}" y2="${(Math.sin(a) * r2).toFixed(1)}" stroke="rgba(220,228,236,${i % 30 === 0 ? .55 : .2})"/>`;
  }
  let labels = "";
  for (let i = 0; i < 360; i += 30) {
    const a = (i - 90) * DEG, r = R + 68;
    labels += `<text x="${(Math.cos(a) * r).toFixed(1)}" y="${(Math.sin(a) * r + 3).toFixed(1)}" text-anchor="middle" font-family="Share Tech Mono" font-size="9" fill="rgba(200,210,220,.55)" letter-spacing="1">${String(i).padStart(3, "0")}</text>`;
  }
  s += `<g class="rg-a">${ticks}${labels}</g>`;
  // rotating arc segments
  const seg = (r, a0, a1, w, op) => { const p = a => `${(Math.cos(a * DEG) * r).toFixed(1)} ${(Math.sin(a * DEG) * r).toFixed(1)}`; return `<path d="M${p(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}" fill="none" stroke="rgba(235,240,244,${op})" stroke-width="${w}"/>`; };
  s += `<g class="rg-b">${seg(R + 20, -30, 40, 2, .7)}${seg(R + 20, 150, 175, 2, .5)}${seg(R + 20, 200, 205, 2, .9)}${seg(R + 20, 95, 98, 2, .9)}</g>`;
  s += `<g class="rg-c">${seg(R + 82, 200, 250, 1, .4)}${seg(R + 82, 20, 70, 1, .4)}</g>`;
  // radar fan sector (upper-left, IMG3)
  let fan = "";
  for (let r = R + 74; r <= R + 130; r += 14) fan += seg(r, 205, 255, 1, r === R + 130 ? .24 : .1);
  for (let ang = 205; ang <= 255; ang += 6.25) { const c = Math.cos(ang * DEG), si = Math.sin(ang * DEG); fan += `<line x1="${(c * (R + 74)).toFixed(1)}" y1="${(si * (R + 74)).toFixed(1)}" x2="${(c * (R + 130)).toFixed(1)}" y2="${(si * (R + 130)).toFixed(1)}" stroke="rgba(220,228,236,.09)"/>`; }
  const pf = (r, a) => `${(Math.cos(a * DEG) * r).toFixed(1)} ${(Math.sin(a * DEG) * r).toFixed(1)}`;
  fan += `<path d="M${pf(R + 74, 205)} A${R + 74} ${R + 74} 0 0 1 ${pf(R + 74, 255)} L${pf(R + 130, 255)} A${R + 130} ${R + 130} 0 0 0 ${pf(R + 130, 205)}Z" fill="rgba(210,220,230,.035)"/>`;
  s += `<g>${fan}</g>`;
  // crosshair brackets
  const L = R + 92, k = 16;
  s += `<g stroke="rgba(230,236,240,.55)" fill="none">
    <path d="M${-L} ${-L + k} V${-L} H${-L + k}"/><path d="M${L - k} ${-L} H${L} V${-L + k}"/>
    <path d="M${-L} ${L - k} V${L} H${-L + k}"/><path d="M${L - k} ${L} H${L} V${L - k}"/></g>`;
  s += `<g stroke="rgba(220,228,236,.35)"><line x1="${-R - 100}" y1="0" x2="${-R - 60}" y2="0"/><line x1="${R + 60}" y1="0" x2="${R + 100}" y2="0"/><line x1="0" y1="${-R - 100}" x2="0" y2="${-R - 78}"/><line x1="0" y1="${R + 78}" x2="0" y2="${R + 100}"/></g>`;
  s += `<text x="${-L + 4}" y="${-L + 30}" font-family="Share Tech Mono" font-size="10" fill="rgba(200,210,220,.6)" letter-spacing="2">DFLY-NET / GLOBE</text>`;
  ringsSvg.innerHTML = s;
  const st = document.getElementById("ringStyle") || document.head.appendChild(Object.assign(document.createElement("style"), { id: "ringStyle" }));
  st.textContent = REDUCED ? "" : `.rg-a{animation:rgs 240s linear infinite}.rg-b{animation:rgs 40s linear infinite reverse}.rg-c{animation:rgs 90s linear infinite}@keyframes rgs{to{transform:rotate(360deg)}}`;
}

/* ---------- sizing ---------- */
let W = 800, H = 800;
function resize() {
  W = wrap.clientWidth; H = wrap.clientHeight;
  if (!W || !H) return;
  RPX = Math.round(Math.min(W, H) * 0.35);
  const pr = Math.min((window.devicePixelRatio || 1) * (window.DFLY_SCALE || 1), 2);
  if (renderer) { renderer.setPixelRatio(pr); renderer.setSize(W, H, false); }
  camera.aspect = W / H;
  camera.position.set(0, 0, (H / 2) / (RPX * Math.tan(15 * DEG)));
  camera.updateProjectionMatrix();
  heads.material.size = 9 * pr;
  buildRings();
}

/* ---------- projection ---------- */
const tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), camDir = new THREE.Vector3();
function project(p) {
  tmp.copy(p).applyMatrix4(globe.matrixWorld);
  nrm.copy(tmp).normalize();
  camDir.copy(camera.position).sub(tmp).normalize();
  const facing = nrm.dot(camDir);
  tmp.project(camera);
  return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H, facing };
}

/* ---------- loop ---------- */
let t0 = performance.now(), lastT = t0, frameN = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!document.hidden) {
    if (target) {
      rotY += (target.y - rotY) * Math.min(1, dt * 3); rotX += (target.x - rotX) * Math.min(1, dt * 3);
      if (Math.abs(target.y - rotY) < 1e-3 && Math.abs(target.x - rotX) < 1e-3) { target = region === "global" ? null : target; }
    } else if (!dragging) {
      velY *= 0.94; velX *= 0.94; rotY += velY; rotX = Math.max(-0.9, Math.min(1.25, rotX + velX));
      if (!REDUCED && region === "global" && !selected && now - idleAt > 2500) rotY -= dt * (2 * Math.PI / 150);
    }
    globe.rotation.set(rotX, rotY, 0);
    if (!REDUCED) { orbits.rotation.y += dt * 0.02; orbits.children.forEach(l => { const st = l.userData.sat; if (st) { st.userData.ph += dt * st.userData.sp; st.position.set(Math.cos(st.userData.ph) * st.userData.r, 0, Math.sin(st.userData.ph) * st.userData.r); } }); }
    globe.updateMatrixWorld();
    shared.uTime.value = REDUCED ? 0 : (now - t0) / 1000;

    // flowing heads
    const hp = heads.geometry.attributes.position;
    arcs.forEach((a, i) => {
      const u = a.mat.uniforms;
      if (a.flash) { a.flash = Math.max(0, a.flash - dt * 0.5); u.uBoost.value = selected && (a.a === selected || a.b === selected) ? Math.max(0.55, a.flash) : a.flash; }
      if (hp) {
        const head = ((shared.uTime.value * u.uSpeed.value + u.uSeed.value) % 1 + 1) % 1;
        const idx = Math.min(a.pts.length - 1, Math.floor(head * (a.pts.length - 1)));
        const p = a.pts[idx]; hp.setXYZ(i, p.x, p.y, p.z);
      }
    });
    if (hp) hp.needsUpdate = true;

    // hubs (labels de-cluttered every few frames)
    const doLab = (frameN++ % 6) === 0, boxes = [];
    for (const h of hubs) {
      const p = project(h.pos);
      const vis = p.facing > 0.08;
      h.el.style.display = vis ? "" : "none";
      if (vis) {
        h.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%)`; h.el.style.opacity = Math.min(1, (p.facing - 0.08) * 4).toFixed(2);
        if (doLab) {
          const big = h.el.classList.contains("hero") || h.el.classList.contains("sel"); const w = h.el.querySelector(".lb").textContent.length * 7.4 + 26, bx = { x: p.x + (big ? 15 : 6), y: p.y - (big ? 16 : 13), w, h: 19 };
          const hit = boxes.some(o => bx.x < o.x + o.w && bx.x + bx.w > o.x && bx.y < o.y + o.h && bx.y + bx.h > o.y);
          h.el.classList.toggle("nolab", hit && h.code !== selected); if (!hit) boxes.push(bx);
        }
      }
      if (h.code === selected) {
        const pop = document.getElementById("pop");
        if (!vis) D.closePop();
        else if (!pop.hidden) { /* keep popover pinned to the hub */
          const pw = 250, ph = pop.offsetHeight; let l = p.x + 18, t = p.y - 30;
          if (l + pw > W - 6) l = p.x - pw - 18; t = Math.max(6, Math.min(H - ph - 6, t));
          pop.style.left = l + "px"; pop.style.top = t + "px";
        }
      }
    }
    if (renderer) renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

resize(); buildArcs(); buildHubs();
requestAnimationFrame(frame);
window.DFLY_GLOBE = { select, project };

/* Dragonfly Real-time data v3 — big command hemisphere + navigator globe (three.js, vendored). */
import * as THREE from "../vendor/three.module.js";

const D = window.DFLY;
const canvas = document.getElementById("gl");
const layer = document.getElementById("hubLayer");
const hud = document.getElementById("hud");
const miniEl = document.getElementById("mini");
const DEG = Math.PI / 180, REDUCED = D.reduced;
const SW = 1920, SH = 1080;
const GC = { x: 1000, y: 1150 }, GR = 800;          // big hemisphere: screen centre + radius (stage px)
const MINI = { x: 1214, y: 62, w: 300, h: 300, r: 128 };
const ELEV = 40 * DEG;                               // focus point sits ~40° above the camera axis (inside the visible cap)

let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); renderer.autoClear = false; renderer.setClearColor(0x000000, 0); }
catch (e) { console.warn("[dfly] WebGL unavailable", e); }

function v3(lat, lon, r = 1) { const la = lat * DEG, lo = lon * DEG; return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)); }
function camDist(fovDeg, halfPx, rPx) { const f = halfPx / Math.tan(fovDeg / 2 * DEG); return 1 / Math.sin(Math.atan(rPx / f)); }

/* ================= shared materials ================= */
const loader = new THREE.TextureLoader();
const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
function tex(url) { const t = loader.load(url); t.anisotropy = aniso; t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t; }
const TEX = { map: tex("tex/earth-mono.jpg"), water: tex("tex/earth-water.jpg"), bump: tex("tex/earth-bump.jpg") };
const uReady = { value: 0 };
function earthMat(light, gain, rim) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: TEX.map }, uWater: { value: TEX.water }, uBump: { value: TEX.bump }, uLight: { value: light.normalize() }, uReady, uGain: { value: gain }, uRim: { value: rim } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMap, uWater, uBump; uniform vec3 uLight; uniform float uReady, uGain, uRim;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec2 uv = vec2(vUv.x + 0.25, vUv.y);
        float alb = texture2D(uMap, uv).r;
        float water = texture2D(uWater, uv).r;
        vec2 px = vec2(1.0/2048.0, 1.0/1024.0);
        float h0 = texture2D(uBump, uv).r, hx = texture2D(uBump, uv + vec2(px.x,0.)).r, hy = texture2D(uBump, uv + vec2(0.,px.y)).r;
        vec3 N = normalize(vN + vec3(h0-hx, h0-hy, 0.0) * 2.0 * (1.0 - water));
        float lam = dot(N, uLight);
        float day = smoothstep(-0.35, 0.8, lam);
        alb = pow(alb, 0.92);
        vec3 col = vec3(alb) * (0.05 + uGain * day * day * (3.0 - 2.0*day));
        vec3 R = reflect(-uLight, N);
        col += vec3(pow(max(dot(R, vV), 0.0), 34.0) * water * 0.6 * day);
        float f = 1.0 - max(dot(vN, vV), 0.0);
        col += vec3(0.64,0.72,0.82) * pow(f, 2.4) * (0.3 + 0.7*smoothstep(-0.3, 0.7, dot(vN, uLight))) * uRim;
        col *= vec3(0.95, 0.98, 1.02);
        col = mix(vec3(0.035,0.04,0.045), col, uReady);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
}
THREE.DefaultLoadingManager.onLoad = () => { const t0 = performance.now(); const f = () => { uReady.value = Math.min(1, (performance.now() - t0) / 1600); if (uReady.value < 1) requestAnimationFrame(f); }; f(); };
setTimeout(() => { if (!uReady.value) uReady.value = 1; }, 9000);
function atmoMesh(r, k, op) {
  const dl = Math.sqrt(1 - 1 / (r * r));
  return new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float d = abs(dot(vN, vV)); float i = pow(clamp(d / ${dl.toFixed(4)}, 0.0, 1.0), ${k.toFixed(2)}) * ${op.toFixed(2)}; gl_FragColor = vec4(vec3(0.70,0.78,0.88)*i, i); }`
  }));
}
function lineMat(color, op) { return new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }); }
function graticule(group, r, step, opMinor, opMajor) {
  const minor = [], major = [];
  for (let lat = -80; lat <= 80; lat += step) { const arr = lat % 30 === 0 ? major : minor; for (let lon = -180; lon < 180; lon += 2) arr.push(v3(lat, lon, r), v3(lat, lon + 2, r)); }
  for (let lon = -180; lon < 180; lon += step) { const arr = lon % 30 === 0 ? major : minor; for (let lat = -84; lat < 84; lat += 2) arr.push(v3(lat, lon, r), v3(lat + 2, lon, r)); }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(minor), lineMat(0xb4c0cc, opMinor)));
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(major), lineMat(0xd6dee6, opMajor)));
}
function sprite() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.3, "rgba(240,244,248,.8)"); gr.addColorStop(1, "rgba(220,230,240,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const SPR = sprite();

/* ================= BIG hemisphere ================= */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(20, SW / SH, 0.1, 100);
camera.position.set(0, 0, camDist(20, SH / 2, GR));
camera.setViewOffset(SW, SH, SW / 2 - GC.x, SH / 2 - GC.y, SW, SH);
const globe = new THREE.Group(); scene.add(globe);
globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), earthMat(new THREE.Vector3(-0.62, 0.62, 0.55), 1.18, 0.95)));
scene.add(atmoMesh(1.035, 2.4, 0.85));
graticule(globe, 1.0018, 10, 0.07, 0.17);
{ const eq = []; for (let lon = -180; lon < 180; lon += 3) eq.push(v3(0, lon, 1.003), v3(0, lon + 1.6, 1.003)); globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(eq), lineMat(0xe8eef4, 0.28))); }
fetch("data/world.json").then(r => r.json()).then(w => {
  const segs = (lines, r) => { const p = []; for (const l of lines) for (let i = 0; i + 3 < l.length; i += 2) p.push(v3(l[i + 1], l[i], r), v3(l[i + 3], l[i + 2], r)); return p; };
  globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs(w.borders, 1.0022)), lineMat(0xc4ced8, 0.10)));
  globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs(w.coast, 1.0026)), lineMat(0xf0f4f8, 0.30)));
}).catch(e => console.warn("[dfly] world data", e));

/* dotted satellite orbits (scene space) */
const orbits = new THREE.Group(); scene.add(orbits);
[[1.12, 62, 14, 0.55, 360], [1.24, 74, -22, 0.38, 420], [1.42, 58, 34, 0.24, 520]].forEach(([r, tx, tz, op, n]) => {
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const ring = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: 0xdfe6ee, size: 2.2, sizeAttenuation: false, transparent: true, opacity: op, depthWrite: false }));
  const g = new THREE.Group(); g.rotation.set(tx * DEG, 0, tz * DEG); g.add(ring);
  const sat = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPR, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sat.scale.setScalar(0.016); sat.userData = { r, ph: Math.random() * 6.28, sp: 0.04 + Math.random() * 0.05 }; g.add(sat); g.userData.sat = sat;
  orbits.add(g);
});

/* surface radar sweep (moves with the toured hub) */
const radarU = { uTime: { value: 0 } };
const radar = new THREE.Mesh(new THREE.CircleGeometry(0.15, 96), new THREE.ShaderMaterial({
  uniforms: radarU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy / 0.15; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uTime; varying vec2 vP;
    void main(){
      float r = length(vP); if (r > 1.0) discard;
      float a = atan(vP.y, vP.x) / 6.28318 + 0.5;
      float s = fract(a + uTime * 0.22);
      float sweep = pow(s, 7.0) * (1.0 - r * 0.7) * 0.42;
      float dr = abs(fract(r * 4.0 + 0.5) - 0.5);
      float rings = (1.0 - smoothstep(0.0, 0.025, dr)) * 0.16 * step(0.1, r);
      float edge = (1.0 - smoothstep(0.0, 0.012, abs(r - 0.985))) * 0.55;
      float da = abs(fract(a * 12.0 + 0.5) - 0.5) * 6.28 * r;
      float spokes = (1.0 - smoothstep(0.0, 0.012, da)) * 0.07 * step(0.15, r);
      float dots = step(0.5, fract(a * 120.0)) * (1.0 - smoothstep(0.0, 0.01, abs(r - 0.92))) * 0.45;
      float al = sweep + rings + edge + spokes + dots;
      gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), al);
    }`
}));
globe.add(radar);

/* arcs */
const shared = { uTime: { value: 0 } };
const arcVS = `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const arcFS = `uniform float uTime, uSeed, uSpeed, uNet, uBoost, uStatic; varying float vT;
  void main(){
    float base = mix(0.38, 0.13, uNet);
    if (uNet > 0.5) base *= step(0.45, fract(vT*70.0));
    float head = fract(uTime*uSpeed + uSeed);
    float d = head - vT; if (d < 0.0) d += 1.0;
    float glow = (1.0 - smoothstep(0.0, mix(0.24, 0.12, uNet), d)) * (1.0 - uStatic);
    float a = base + glow*mix(1.0, 0.5, uNet) + uBoost*0.8;
    vec3 col = mix(vec3(0.82,0.86,0.91), vec3(1.0), glow);
    col = mix(col, vec3(0.95,0.78,0.52), clamp(uBoost, 0.0, 1.0)*0.75);
    float edge = smoothstep(0.0, 0.04, vT) * smoothstep(1.0, 0.96, vT);
    gl_FragColor = vec4(col, a*edge);
  }`;
let arcs = [];
const arcGroup = new THREE.Group(); globe.add(arcGroup);
const heads = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: SPR, size: 10, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }));
globe.add(heads);
function arcPoints(A, B, lift, N = 80) {
  const va = v3(A.lat, A.lon), vb = v3(B.lat, B.lon), ang = va.angleTo(vb), s = Math.sin(ang), pts = [];
  const h = lift + ang * 0.2;
  for (let k = 0; k <= N; k++) {
    const t = k / N, p = s > 1e-4 ? va.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(vb.clone().multiplyScalar(Math.sin(t * ang) / s)) : va.clone();
    pts.push(p.multiplyScalar(1.004 + Math.sin(Math.PI * t) * h));
  }
  return pts;
}
function buildArcs() {
  arcGroup.clear(); arcs = [];
  const S = D.state();
  D.allArcs().forEach((r, i) => {
    const pts = arcPoints(S.airports[r.a], S.airports[r.b], 0.035);
    const g = new THREE.BufferGeometry().setFromPoints(pts); g.setAttribute("aT", new THREE.Float32BufferAttribute(pts.map((_, k) => k / (pts.length - 1)), 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: shared.uTime, uSeed: { value: (i * 0.137) % 1 }, uSpeed: { value: (r.net ? 0.09 : 0.2) * (0.8 + ((i * 7) % 5) / 10) }, uNet: { value: r.net ? 1 : 0 }, uBoost: { value: 0 }, uStatic: { value: REDUCED ? 1 : 0 } },
      vertexShader: arcVS, fragmentShader: arcFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    arcGroup.add(new THREE.Line(g, m));
    arcs.push({ a: r.a, b: r.b, net: r.net, pts, mat: m, flash: 0 });
  });
  heads.geometry.dispose();
  const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(arcs.length * 3), 3)); heads.geometry = hg;
  heads.visible = !REDUCED;
}

/* ================= NAVIGATOR mini globe ================= */
const mScene = new THREE.Scene();
const mCam = new THREE.PerspectiveCamera(20, 1, 0.1, 100);
mCam.position.set(0, 0, camDist(20, MINI.h / 2, MINI.r));
const mGlobe = new THREE.Group(); mScene.add(mGlobe);
mGlobe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), earthMat(new THREE.Vector3(-0.55, 0.5, 0.67), 1.2, 1.1)));
mScene.add(atmoMesh(1.06, 2.2, 0.9));
graticule(mGlobe, 1.003, 15, 0.12, 0.22);
const mDots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: SPR, size: 7, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xf2d5a4 }));
mGlobe.add(mDots);
const mArcs = new THREE.Group(); mGlobe.add(mArcs);
function buildMini() {
  const S = D.state(), pos = [];
  Object.keys(S.airports).forEach(c => { const a = S.airports[c]; const p = v3(a.lat, a.lon, 1.01); pos.push(p.x, p.y, p.z); });
  mDots.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); mDots.geometry = g;
  mArcs.clear();
  D.allArcs().forEach(r => { mArcs.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints(S.airports[r.a], S.airports[r.b], 0.02, 40)), lineMat(r.net ? 0xb8c4d0 : 0xf0f4f8, r.net ? 0.18 : 0.5))); });
}

/* ================= view state (shared focus lat/lon) ================= */
const view = { lat: 31, lon: 121.5 };          // target focus
const big = { lat: 31, lon: 121.5, vl: 0, vo: 0 };   // spring-followed by the hemisphere
const mini = { lat: 31, lon: 121.5 };          // mini follows target quickly
function wrapNear(lon, ref) { while (lon - ref > 180) lon -= 360; while (ref - lon > 180) lon += 360; return lon; }
function setFocus(lat, lon) { view.lat = Math.max(-55, Math.min(72, lat)); view.lon = wrapNear(lon, big.lon); }

/* ================= hubs (HTML) ================= */
let hubs = [];
function heroCodes() {
  const S = D.state();
  return Object.keys(S.airports).filter(c => !S.airports[c].minor).map(c => [c, D.hubInfo(c).today]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
}
let staticHeroes = new Set();
function buildHubs() {
  layer.innerHTML = ""; hubs = [];
  const S = D.state();
  const active = new Set(); D.allArcs().forEach(r => { if (!r.net) { active.add(r.a); active.add(r.b); } });
  staticHeroes = new Set(heroCodes());
  Object.keys(S.airports).forEach(code => {
    const a = S.airports[code], el = document.createElement("div");
    el.className = "hub" + (a.minor ? " minor" : "") + (active.has(code) ? " act" : " net");
    el.innerHTML = `<span class="ret"><i class="r3"></i><i class="r2"></i><i class="tk"></i><i class="r1"></i><i class="r0"></i></span><span class="dot"></span><span class="tagl"><b>${D.city(code)}</b><i>${code}</i></span>`;
    el.addEventListener("click", ev => { ev.stopPropagation(); flyAndSelect(code, true); });
    layer.appendChild(el);
    hubs.push({ code, el, minor: !!a.minor, act: active.has(code), pos: v3(a.lat, a.lon, 1.006), lab: el.querySelector(".tagl b"), lat: a.lat, lon: a.lon });
  });
}
function relabel() { hubs.forEach(h => { h.lab.textContent = D.city(h.code); }); }

/* ================= selection / tour ================= */
let selected = null, toured = "PVG", pendingSel = null, lastUser = performance.now(), nextTour = performance.now() + 9000, modalOpen = false;
function select(code) {
  selected = code;
  hubs.forEach(h => h.el.classList.toggle("sel", h.code === code));
  const h = hubs.find(x => x.code === code); if (!h) return;
  const p = project(h.pos); D.openHub(code, p.x, p.y);
  arcs.forEach(a => { a.mat.uniforms.uBoost.value = (a.a === code || a.b === code) ? 0.55 : 0; });
}
function flyAndSelect(code, immediate) {
  const a = D.state().airports[code]; if (!a) return;
  toured = code; setFocus(a.lat, a.lon); lastUser = performance.now();
  if (immediate) select(code); else { pendingSel = code; }
}
function tourNext() {
  const S = D.state();
  const pool = hubs.filter(h => !h.minor && h.code !== toured && (h.act || Math.random() < 0.35)).map(h => h.code);
  const code = pool[Math.random() * pool.length | 0] || "PVG";
  toured = code; const a = S.airports[code]; setFocus(a.lat, a.lon);
}
D.bus.addEventListener("hub", e => { if (!e.detail) { selected = null; hubs.forEach(h => h.el.classList.remove("sel")); arcs.forEach(a => a.mat.uniforms.uBoost.value = 0); lastUser = performance.now(); nextTour = lastUser + 7000; } });
D.bus.addEventListener("focus", e => flyAndSelect(e.detail, false));
D.bus.addEventListener("modal", e => { modalOpen = !!e.detail; });
D.bus.addEventListener("settle", e => {
  const { from, to } = e.detail;
  let a = arcs.find(x => (x.a === from && x.b === to) || (x.a === to && x.b === from));
  if (!a) { buildArcs(); buildMini(); a = arcs.find(x => (x.a === from && x.b === to) || (x.a === to && x.b === from)); }
  if (a) a.flash = 1.4;
  hubs.forEach(h => { if (h.code === to || h.code === from) { h.el.classList.remove("pulse"); void h.el.offsetWidth; h.el.classList.add("pulse"); } });
});
D.bus.addEventListener("lang", relabel);
D.bus.addEventListener("data", () => { buildArcs(); buildHubs(); buildMini(); });
D.bus.addEventListener("resize", resize);

/* ================= mini interaction ================= */
let drag = null;
function stageXY(e) { const r = document.getElementById("stage").getBoundingClientRect(), s = window.DFLY_SCALE || 1; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; }
miniEl.addEventListener("pointerdown", e => { const p = stageXY(e); drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: 0 }; miniEl.setPointerCapture(e.pointerId); lastUser = performance.now(); });
miniEl.addEventListener("pointermove", e => {
  if (!drag) return; const p = stageXY(e), dx = p.x - drag.x, dy = p.y - drag.y; drag.x = p.x; drag.y = p.y; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved > 3) { D.closePop(); setFocus(view.lat + dy / MINI.r / DEG * 0.9, view.lon - dx / MINI.r / DEG * 0.9); mini.lat = view.lat; mini.lon = view.lon; toured = null; }
  lastUser = performance.now();
});
function miniUp(e) {
  if (!drag) return; const d = drag; drag = null; lastUser = performance.now(); nextTour = lastUser + 10000;
  if (d.moved > 3) return;
  const nx = (d.sx - MINI.x - MINI.w / 2) / MINI.r, ny = -(d.sy - MINI.y - MINI.h / 2) / MINI.r, q = nx * nx + ny * ny;
  if (q > 1) return;
  const p = new THREE.Vector3(nx, ny, Math.sqrt(1 - q)).applyQuaternion(mGlobe.quaternion.clone().invert());
  const lat = Math.asin(p.y) / DEG, lon = Math.atan2(p.x, p.z) / DEG;
  const S = D.state(); let best = null, bd = 9;
  Object.keys(S.airports).forEach(c => { const a = S.airports[c]; if (a.minor) return; const dd = v3(lat, lon).angleTo(v3(a.lat, a.lon)) / DEG; if (dd < bd) { bd = dd; best = c; } });
  if (best) flyAndSelect(best, false); else { D.closePop(); toured = null; setFocus(lat, lon); }
}
miniEl.addEventListener("pointerup", miniUp); miniEl.addEventListener("pointercancel", () => { drag = null; });

/* ================= HUD (SVG overlay) ================= */
let hudLink = null, hudLink2 = null;
function buildHud() {
  const P = (r, a) => `${(GC.x + Math.cos(a * DEG) * r).toFixed(1)} ${(GC.y + Math.sin(a * DEG) * r).toFixed(1)}`;
  const arc = (r, a0, a1, attrs) => `<path d="M${P(r, a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${P(r, a1)}" fill="none" ${attrs}/>`;
  let s = "";
  // big translucent radar fan (upper-left, IMG1)
  const f0 = 204, f1 = 244, rIn = GR - 160, rOut = GR + 210;
  s += `<path d="M${P(rIn, f0)} A${rIn} ${rIn} 0 0 1 ${P(rIn, f1)} L${P(rOut, f1)} A${rOut} ${rOut} 0 0 0 ${P(rOut, f0)}Z" fill="url(#fanG)"/>`;
  for (let r = rIn; r <= rOut; r += 37) s += arc(r, f0, f1, `stroke="rgba(226,232,238,${r === rOut ? .32 : .1})"`);
  for (let a = f0; a <= f1 + .01; a += 5) s += `<line x1="${P(rIn, a).split(" ")[0]}" y1="${P(rIn, a).split(" ")[1]}" x2="${P(rOut, a).split(" ")[0]}" y2="${P(rOut, a).split(" ")[1]}" stroke="rgba(226,232,238,${a === f0 || a >= f1 ? .3 : .07})"/>`;
  s += `<g class="fan-sweep" clip-path="url(#fanClip)"><path d="M${GC.x} ${GC.y} L${P(rOut + 40, 0)} A${rOut + 40} ${rOut + 40} 0 0 0 ${P(rOut + 40, -14)}Z" fill="url(#swG)"/></g>`;
  // limb rings + ticks
  s += arc(GR + 14, 196, 344, `stroke="rgba(226,232,238,.16)"`);
  s += arc(GR + 46, 200, 340, `stroke="rgba(226,232,238,.10)" stroke-dasharray="1 6"`);
  let tk = "";
  for (let a = 200; a <= 340; a += 1) { const big2 = a % 10 === 0, r1 = GR + 22, r2 = GR + (big2 ? 36 : a % 5 === 0 ? 30 : 26); tk += `<line x1="${P(r1, a).split(" ")[0]}" y1="${P(r1, a).split(" ")[1]}" x2="${P(r2, a).split(" ")[0]}" y2="${P(r2, a).split(" ")[1]}" stroke="rgba(226,232,238,${big2 ? .45 : .14})"/>`; }
  s += `<g>${tk}</g>`;
  for (let a = 210; a <= 330; a += 20) { const [x, y] = P(GR + 58, a).split(" "); s += `<text x="${x}" y="${y}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="rgba(210,218,226,.42)" letter-spacing="1" transform="rotate(${a + 90} ${x} ${y})">${String(a - 270).replace("-", "−")}°</text>`; }
  s += `<g class="limb-run">${arc(GR + 14, 250, 262, `stroke="rgba(244,247,250,.85)" stroke-width="2"`)}${arc(GR + 14, 300, 304, `stroke="rgba(240,200,134,.9)" stroke-width="2"`)}</g>`;
  // top crosshair
  s += `<g stroke="rgba(226,232,238,.4)"><line x1="${GC.x}" y1="${GC.y - GR - 92}" x2="${GC.x}" y2="${GC.y - GR - 70}"/><line x1="${GC.x - 10}" y1="${GC.y - GR - 81}" x2="${GC.x + 10}" y2="${GC.y - GR - 81}"/></g>`;
  s += `<text x="${GC.x + 18}" y="${GC.y - GR - 77}" font-family="IBM Plex Mono" font-size="10" fill="rgba(210,218,226,.5)" letter-spacing="2">DFLY-NET · BASE 8453</text>`;
  // link lines: focus reticle → navigator
  s += `<line id="hudLink" stroke="rgba(230,236,242,.28)" stroke-width="1"/><line id="hudLink2" stroke="rgba(230,236,242,.12)" stroke-width="1" stroke-dasharray="2 4"/>`;
  const defs = `<defs><radialGradient id="fanG" cx="${GC.x}" cy="${GC.y}" r="${rOut}" gradientUnits="userSpaceOnUse"><stop offset="${(rIn / rOut).toFixed(3)}" stop-color="rgba(220,228,236,.0)"/><stop offset="1" stop-color="rgba(220,228,236,.07)"/></radialGradient>
    <linearGradient id="swG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(240,244,248,.0)"/><stop offset="1" stop-color="rgba(240,244,248,.16)"/></linearGradient>
    <clipPath id="fanClip"><path d="M${P(rIn, f0)} A${rIn} ${rIn} 0 0 1 ${P(rIn, f1)} L${P(rOut, f1)} A${rOut} ${rOut} 0 0 0 ${P(rOut, f0)}Z"/></clipPath></defs>`;
  hud.innerHTML = defs + s;
  hudLink = document.getElementById("hudLink"); hudLink2 = document.getElementById("hudLink2");
  const st = document.getElementById("hudStyle") || document.head.appendChild(Object.assign(document.createElement("style"), { id: "hudStyle" }));
  st.textContent = REDUCED ? "" : `.fan-sweep path{transform-box:view-box;transform-origin:${GC.x}px ${GC.y}px;animation:fsw 7s linear infinite}@keyframes fsw{from{transform:rotate(198deg)}to{transform:rotate(262deg)}}
    .limb-run{transform-box:view-box;transform-origin:${GC.x}px ${GC.y}px;animation:lr 26s ease-in-out infinite alternate}@keyframes lr{to{transform:rotate(60deg)}}`;
  // mini globe rings
  const ms = document.querySelector(".mini-rings"), R = MINI.r;
  const ma = (r, a0, a1, attrs) => { const p = a => `${(Math.cos(a * DEG) * r).toFixed(1)} ${(Math.sin(a * DEG) * r).toFixed(1)}`; return `<path d="M${p(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}" fill="none" ${attrs}/>`; };
  let m = `<circle r="${R + 8}" fill="none" stroke="rgba(226,232,238,.25)"/>`;
  let mt = ""; for (let a = 0; a < 360; a += 3) { const r1 = R + 14, r2 = R + (a % 30 === 0 ? 24 : 18), c = Math.cos(a * DEG), si = Math.sin(a * DEG); mt += `<line x1="${(c * r1).toFixed(1)}" y1="${(si * r1).toFixed(1)}" x2="${(c * r2).toFixed(1)}" y2="${(si * r2).toFixed(1)}" stroke="rgba(226,232,238,${a % 30 === 0 ? .5 : .16})"/>`; }
  m += `<g class="mr-a">${mt}</g><g class="mr-b">${ma(R + 30, -40, 20, `stroke="rgba(240,244,248,.7)" stroke-width="1.5"`)}${ma(R + 30, 150, 170, `stroke="rgba(240,200,134,.8)" stroke-width="1.5"`)}</g>`;
  m += `<g stroke="rgba(240,200,134,.9)" fill="none" stroke-width="1.4"><circle r="9"/><path d="M-18 0h-8M18 0h8M0 -18v-8M0 18v8"/></g><circle r="2" fill="#f0c886"/>`;
  m += `<g stroke="rgba(230,236,240,.6)" fill="none"><path d="M${-R - 34} ${-R + 2} V${-R - 34} H${-R + 2}"/><path d="M${R - 2} ${-R - 34} H${R + 34} V${-R + 2}"/><path d="M${-R - 34} ${R - 2} V${R + 34} H${-R + 2}"/><path d="M${R - 2} ${R + 34} H${R + 34} V${R - 2}"/></g>`;
  ms.innerHTML = m;
  st.textContent += REDUCED ? "" : `.mr-a{animation:mrs 120s linear infinite}.mr-b{animation:mrs 30s linear infinite reverse}@keyframes mrs{to{transform:rotate(360deg)}}`;
}

/* ================= sizing ================= */
let PR = 1;
function resize() {
  PR = Math.min((window.devicePixelRatio || 1) * (window.DFLY_SCALE || 1), 2);
  if (renderer) { renderer.setPixelRatio(PR); renderer.setSize(SW, SH, false); }
  heads.material.size = 10 * PR; mDots.material.size = 7 * PR;
  orbits.children.forEach(g => { g.children[0].material.size = 2.2 * PR; });
}

/* ================= projection ================= */
const tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), cdir = new THREE.Vector3();
function project(p) {
  tmp.copy(p).applyMatrix4(globe.matrixWorld); nrm.copy(tmp).normalize(); cdir.copy(camera.position).sub(tmp).normalize();
  const facing = nrm.dot(cdir); tmp.project(camera);
  return { x: (tmp.x * 0.5 + 0.5) * SW, y: (-tmp.y * 0.5 + 0.5) * SH, facing };
}

/* ================= frame ================= */
const T0 = performance.now(); let lastT = T0, frameN = 0;
const radarQ = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!document.hidden) {
    // auto-tour when idle
    if (!REDUCED && !selected && !drag && !modalOpen && !pendingSel && now > nextTour && now - lastUser > 8000) { tourNext(); nextTour = now + 9500; }
    // springs
    const K = REDUCED ? 6 : 2.1;
    big.vl += (K * K * (view.lat - big.lat) - 2 * K * big.vl) * dt; big.lat += big.vl * dt;
    big.vo += (K * K * (view.lon - big.lon) - 2 * K * big.vo) * dt; big.lon += big.vo * dt;
    if (!drag) { const km = Math.min(1, dt * 7); mini.lat += (view.lat - mini.lat) * km; mini.lon += (wrapNear(view.lon, mini.lon) - mini.lon) * km; }
    if (!REDUCED && !drag && !selected && Math.abs(view.lon - big.lon) < 0.3) { view.lon -= dt * 0.6; }   // gentle drift while dwelling
    if (pendingSel && Math.abs(view.lat - big.lat) + Math.abs(view.lon - big.lon) < 1.2) { const c = pendingSel; pendingSel = null; select(c); }

    globe.rotation.set(big.lat * DEG - ELEV, -big.lon * DEG, 0); globe.updateMatrixWorld();
    mGlobe.rotation.set(mini.lat * DEG, -mini.lon * DEG, 0); mGlobe.updateMatrixWorld();
    shared.uTime.value = REDUCED ? 0 : (now - T0) / 1000; radarU.uTime.value = shared.uTime.value;
    if (!REDUCED) orbits.children.forEach((g, i) => { const st = g.userData.sat; st.userData.ph += dt * st.userData.sp; st.position.set(Math.cos(st.userData.ph) * st.userData.r, 0, Math.sin(st.userData.ph) * st.userData.r); g.rotation.y += dt * 0.01 * (i + 1); });

    // radar disk at focus hub (or view centre)
    const fa = toured && D.state().airports[toured];
    const rp = fa ? v3(fa.lat, fa.lon, 1.0035) : v3(view.lat, view.lon, 1.0035);
    radar.position.copy(rp); radarQ.setFromUnitVectors(zAxis, rp.clone().normalize()); radar.quaternion.copy(radarQ);

    const hp = heads.geometry.attributes.position;
    arcs.forEach((a, i) => {
      const u = a.mat.uniforms;
      if (a.flash > 0) { a.flash = Math.max(0, a.flash - dt * 0.6); u.uBoost.value = selected && (a.a === selected || a.b === selected) ? Math.max(0.55, a.flash) : Math.min(1, a.flash); }
      if (hp) { const h = ((shared.uTime.value * u.uSpeed.value + u.uSeed.value) % 1 + 1) % 1; const p = a.pts[Math.min(a.pts.length - 1, Math.floor(h * (a.pts.length - 1)))]; hp.setXYZ(i, p.x, p.y, p.z); }
    });
    if (hp) hp.needsUpdate = true;

    // hubs
    const doLab = (frameN++ % 6) === 0, boxes = [];
    const heroes = new Set(staticHeroes); if (toured) heroes.add(toured); if (selected) heroes.add(selected);
    const order = doLab ? hubs.slice().sort((x, y) => (heroes.has(y.code) - heroes.has(x.code)) || (y.act - x.act) || (x.minor - y.minor)) : hubs;
    let focusXY = null;
    for (const h of order) {
      const p = project(h.pos), vis = p.facing > 0.1 && p.y < 935;
      if (vis !== h.vis) { h.el.style.display = vis ? "" : "none"; h.vis = vis; }
      if (!vis) { if (h.code === selected) D.closePop(); continue; }
      h.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
      h.el.style.opacity = Math.min(1, (p.facing - 0.1) * 5).toFixed(2);
      const hero = heroes.has(h.code);
      h.el.classList.toggle("hero", hero);
      if (h.code === (toured || selected)) focusXY = p;
      if (doLab) {
        const left = p.x > 1300; h.el.classList.toggle("left", left);
        const w = (h.lab.textContent.length + 4) * 7.6 + 30, off = hero ? 34 : 12;
        const bx = { x: left ? p.x - off - w : p.x + off, y: p.y - 12, w, h: 24 };
        if (hero) boxes.push({ x: p.x - 26, y: p.y - 26, w: 52, h: 52 });
        const hit = boxes.some(o => bx.x < o.x + o.w + 4 && bx.x + bx.w + 4 > o.x && bx.y < o.y + o.h && bx.y + bx.h > o.y);
        const hide = (hit && !hero) || (h.minor && !hero);
        h.el.classList.toggle("hide-tag", hide); if (!hide) boxes.push(bx);
      }
      if (h.code === selected) D.movePop(p.x, p.y);
    }
    if (hudLink) {
      if (focusXY) {
        const mx = MINI.x + MINI.w / 2, my = MINI.y + MINI.h / 2, ang = Math.atan2(focusXY.y - my, focusXY.x - mx);
        const ex = mx + Math.cos(ang) * (MINI.r + 8), ey = my + Math.sin(ang) * (MINI.r + 8);
        hudLink.setAttribute("x1", (focusXY.x + Math.cos(ang + Math.PI) * 30).toFixed(1)); hudLink.setAttribute("y1", (focusXY.y + Math.sin(ang + Math.PI) * 30).toFixed(1));
        hudLink.setAttribute("x2", ex.toFixed(1)); hudLink.setAttribute("y2", ey.toFixed(1)); hudLink.style.opacity = 1;
        hudLink2.setAttribute("x1", (focusXY.x - 30).toFixed(1)); hudLink2.setAttribute("y1", focusXY.y.toFixed(1)); hudLink2.setAttribute("x2", "384"); hudLink2.setAttribute("y2", focusXY.y.toFixed(1));
        hudLink2.style.opacity = 1;
      } else { hudLink.style.opacity = 0; hudLink2.style.opacity = 0; }
    }
    if (frameN % 10 === 0) { const ll = document.getElementById("miniLL"); const la = mini.lat, lo = ((mini.lon % 360) + 540) % 360 - 180; ll.textContent = Math.abs(la).toFixed(1) + (la >= 0 ? "N " : "S ") + Math.abs(lo).toFixed(1) + (lo >= 0 ? "E" : "W"); }

    if (renderer) {
      renderer.setScissorTest(false); renderer.setViewport(0, 0, SW, SH); renderer.clear();
      renderer.render(scene, camera);
      renderer.setViewport(MINI.x, SH - MINI.y - MINI.h, MINI.w, MINI.h); renderer.setScissor(MINI.x, SH - MINI.y - MINI.h, MINI.w, MINI.h); renderer.setScissorTest(true);
      renderer.clearDepth(); renderer.render(mScene, mCam);
    }
  }
  requestAnimationFrame(frame);
}

resize(); buildHud(); buildArcs(); buildHubs(); buildMini();
requestAnimationFrame(frame);
window.DFLY_GLOBE = { select: c => flyAndSelect(c, true), fly: (lat, lon) => setFocus(lat, lon), view, big, mini, project, state: () => ({ toured, selected, pendingSel }) };

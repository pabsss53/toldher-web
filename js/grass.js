/* ==========================================================================
   TOLD HER — grass.js
   Hamparan rumput 3D (WebGL / Three.js) yang tertiup angin + logo bulu melayang.
   - Ratusan ribu helai rumput di-render sekali jalan (instancing) -> ringan
   - Angin dihitung di GPU (vertex shader), bukan di JS
   - Kursor = angin: rumput kesibak waktu mouse lewat
   - Auto-turun kualitas kalau device-nya kentang
   ========================================================================== */
import * as THREE from '../vendor/three.module.min.js';

/* ---------- Bukit: fungsi yang sama dipakai di GLSL & JS ---------- */
const HILL_GLSL = /* glsl */ `
float hillH(vec2 p){
  float h = 0.0;
  h += sin(p.x*0.09+1.3)*cos(p.y*0.075+0.4)*2.6;
  h += sin(p.x*0.21+p.y*0.16+2.0)*0.45;
  h += sin(p.x*0.045-p.y*0.06+0.7)*3.2;
  float back = 1.0 - smoothstep(-85.0,-6.0,p.y);
  h += back*(6.0+4.0*sin(p.x*0.05+1.0)+2.0*sin(p.x*0.13));
  float side = smoothstep(14.0,60.0,abs(p.x));
  h += side*3.0*(0.5+0.5*sin(p.y*0.05));
  return h;
}`;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function hillJS(x, z) {
  let h = 0;
  h += Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.075 + 0.4) * 2.6;
  h += Math.sin(x * 0.21 + z * 0.16 + 2.0) * 0.45;
  h += Math.sin(x * 0.045 - z * 0.06 + 0.7) * 3.2;
  const back = 1 - sstep(-85, -6, z);
  h += back * (6 + 4 * Math.sin(x * 0.05 + 1) + 2 * Math.sin(x * 0.13));
  const side = sstep(14, 60, Math.abs(x));
  h += side * 3 * (0.5 + 0.5 * Math.sin(z * 0.05));
  return h;
}

const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(7.1,3.7); a*=0.5; } return s; }
`;

const FOG_COLOR = new THREE.Color(0.80, 0.91, 1.0);
const FOG_DENSITY = 0.0135;

/* random yang bisa diulang (biar rumputnya konsisten) */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- helper tekstur ---------- */
function puffTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(S / 2, S * 0.42, 6, S / 2, S / 2, S * 0.48);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.6, 'rgba(255,255,255,0.96)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* atlas doodle: hati, bintang, bunga, squiggle, spiral, daun, bulat, plus  (gaya spidol) */
function doodleAtlas() {
  const S = 128, c = document.createElement('canvas'); c.width = S * 4; c.height = S * 2;
  const g = c.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round';
  const draw = (i, build, fill, stroke) => {
    g.save(); g.translate((i % 4) * S, Math.floor(i / 4) * S);
    const p = new Path2D(); build(p);
    g.lineWidth = 22; g.strokeStyle = '#fff'; g.stroke(p);
    if (fill) { g.fillStyle = fill; g.fill(p); }
    g.lineWidth = 8; g.strokeStyle = stroke; g.stroke(p);
    g.restore();
  };
  // 0 hati
  draw(0, p => { p.moveTo(64, 104); p.bezierCurveTo(8, 66, 20, 20, 62, 46); p.bezierCurveTo(108, 18, 122, 66, 64, 104); }, '#ff5c8a', '#c2185b');
  // 1 bintang
  draw(1, p => { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 24 : 54; const x = 64 + Math.cos(a) * r, y = 66 + Math.sin(a) * r; k ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); }, '#ffe14d', '#e08a00');
  // 2 bunga (kayak di kaos)
  draw(2, p => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; p.moveTo(64, 64); p.ellipse(64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28, 20, 13, a, 0, Math.PI * 2); } }, '#7ec8ff', '#2a5bd7');
  draw(2, p => { p.arc(64, 64, 11, 0, Math.PI * 2); }, '#ffe14d', '#2a5bd7');
  // 3 squiggle
  draw(3, p => { p.moveTo(10, 70); for (let k = 0; k < 5; k++) { p.quadraticCurveTo(10 + k * 25 + 12, k % 2 ? 90 : 38, 10 + k * 25 + 25, 64); } }, null, '#7b2dbf');
  // 4 spiral
  draw(4, p => { for (let t = 0; t < 4.6 * Math.PI; t += 0.2) { const r = 4 + t * 4.1, x = 64 + Math.cos(t) * r, y = 64 + Math.sin(t) * r; t ? p.lineTo(x, y) : p.moveTo(x, y); } }, null, '#ff7a1a');
  // 5 daun
  draw(5, p => { p.moveTo(18, 100); p.quadraticCurveTo(14, 20, 100, 22); p.quadraticCurveTo(108, 100, 18, 100); p.moveTo(24, 94); p.lineTo(80, 40); }, '#8be04e', '#1f8a2b');
  // 6 bulat doodle
  draw(6, p => { p.moveTo(64, 20); p.bezierCurveTo(120, 18, 116, 108, 62, 108); p.bezierCurveTo(10, 108, 10, 24, 70, 22); }, null, '#e53935');
  // 7 plus / silang
  draw(7, p => { p.moveTo(64, 20); p.lineTo(64, 108); p.moveTo(22, 64); p.lineTo(106, 64); }, null, '#00a86b');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* bunga daisy putih kecil buat di tanah */
function daisyTexture() {
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  for (let k = 0; k < 9; k++) {
    g.save(); g.rotate(k * Math.PI * 2 / 9);
    g.beginPath(); g.ellipse(0, -24, 8, 20, 0, 0, Math.PI * 2);
    g.fillStyle = '#ffffff'; g.fill(); g.restore();
  }
  g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fillStyle = '#ffd23a'; g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ==========================================================================
   createGrass
   ========================================================================== */
export function createGrass(canvas, opts = {}) {
  const isMobile = matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  let quality = isMobile ? 0.45 : (cores <= 4 ? 0.7 : 1);
  if (reduced) quality = Math.min(quality, 0.4);
  if (opts.quality) quality = opts.quality;
  let maxDPR = isMobile ? 1.5 : 2;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setClearColor(FOG_COLOR, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 400);
  camera.rotation.order = 'YXZ';

  /* -------- state yang dianimasikan GSAP dari main.js -------- */
  const state = {
    camY: 2.0,     // tinggi kamera dari tanah
    camZ: 13,
    pitch: 0.14,    // + = mendongak
    logoY: 3.1,     // tinggi logo dari tanah
    logoZ: -3,
    logoScale: 1,
    logoSpin: 0,    // putaran ekstra (radian)
    logoRoll: 0,
    logoKick: 0,    // putaran dari klik / intro
    logoPop: 0,     // efek nge-pop
    logoIntro: 1,   // 0 -> 1 pas awal muncul
    wind: 1,
    petals: 1,
  };

  const mouse = { x: 0, y: 0, tx: 0, ty: 0, on: 0, worldX: 0, worldZ: 0 };

  /* -------- sky -------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vDir; uniform float uTime;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y,0.0,1.0);
        vec3 horizon = vec3(0.80,0.91,1.0), mid = vec3(0.40,0.69,1.0), top = vec3(0.13,0.42,0.93);
        vec3 col = mix(horizon, mid, smoothstep(0.0,0.22,h));
        col = mix(col, top, smoothstep(0.18,0.85,h));
        vec3 sunDir = normalize(vec3(0.45,0.42,-0.75));
        float sd = max(dot(d,sunDir),0.0);
        col += vec3(1.0,0.96,0.82)*pow(sd,120.0)*0.55 + vec3(1.0,0.95,0.8)*pow(sd,10.0)*0.03;
        if(d.y>0.0){
          vec2 uv = d.xz/(d.y+0.16)*1.1 + vec2(uTime*0.012,0.0);
          float c = fbm(uv*1.3);
          float cov = smoothstep(0.50,0.80,c);
          float under = smoothstep(0.45,0.95,fbm(uv*1.3+vec2(0.18,0.30)));
          vec3 cc = mix(vec3(1.0), vec3(0.76,0.85,0.97), clamp(c*1.4-0.6,0.0,1.0)*0.75 + under*0.12);
          col = mix(col, cc, cov*smoothstep(0.0,0.10,d.y)*0.92);
        }
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  /* -------- ground -------- */
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { uFog: { value: FOG_COLOR }, uFogD: { value: FOG_DENSITY } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying float vFogF; varying vec3 vN;
      uniform float uFogD;
      ${HILL_GLSL}
      void main(){
        vec3 p = position; p.y = hillH(p.xz);
        float e=0.7;
        vN = normalize(vec3(hillH(p.xz-vec2(e,0.))-hillH(p.xz+vec2(e,0.)), 2.*e, hillH(p.xz-vec2(0.,e))-hillH(p.xz+vec2(0.,e))));
        vW = p;
        vec4 mv = viewMatrix*vec4(p,1.0);
        vFogF = 1.0 - exp(-pow(length(mv.xyz)*uFogD,2.0));
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vW; varying float vFogF; varying vec3 vN;
      uniform vec3 uFog;
      ${NOISE_GLSL}
      void main(){
        float n = fbm(vW.xz*0.35)*0.7 + vnoise(vW.xz*3.0)*0.3;
        vec3 dark = vec3(0.06,0.30,0.07), lit = vec3(0.38,0.70,0.14);
        float light = clamp(dot(normalize(vN), normalize(vec3(0.5,0.75,0.35)))*0.65+0.5, 0.2, 1.15);
        vec3 col = mix(dark, lit, clamp(n*1.15,0.0,1.0)) * light;
        gl_FragColor = vec4(mix(col, uFog, vFogF),1.0);
      }`,
  });
  const groundGeo = new THREE.PlaneGeometry(420, 420, 210, 210);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.frustumCulled = false;
  scene.add(ground);

  /* -------- rumput (instanced) -------- */
  const bladeBase = (() => {
    const segs = 6, pos = [], idx = [];
    for (let i = 0; i < segs; i++) { const y = i / segs; pos.push(-0.5, y, 0, 0.5, y, 0); }
    pos.push(0, 1, 0);
    for (let i = 0; i < segs - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const t = (segs - 1) * 2; idx.push(t, t + 1, t + 2);
    return { pos: new Float32Array(pos), idx };
  })();

  const grassUniforms = {
    uTime: { value: 0 }, uWind: { value: 1 }, uMouse: { value: new THREE.Vector2(999, 999) },
    uMouseOn: { value: 0 }, uFog: { value: FOG_COLOR }, uFogD: { value: FOG_DENSITY },
  };
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: grassUniforms,
    vertexShader: /* glsl */ `
      precision highp float;
      uniform float uTime, uWind, uMouseOn, uFogD; uniform vec2 uMouse;
      attribute vec3 aOffset; attribute vec4 aParams;
      varying vec3 vCol; varying float vFogF;
      ${HILL_GLSL}
      void main(){
        vec2 xz = aOffset.xy; float seed = aOffset.z;
        float H = aParams.x, W = aParams.y, yaw = aParams.z, lean = aParams.w;
        float gy = hillH(xz);
        float e = 0.6;
        vec3 n = normalize(vec3(hillH(xz-vec2(e,0.))-hillH(xz+vec2(e,0.)), 2.*e, hillH(xz-vec2(0.,e))-hillH(xz+vec2(0.,e))));
        float y = position.y;
        float taper = 1.0 - y*0.88;
        vec3 loc = vec3(position.x*W*taper, y*H, lean*y*y*H);
        float c = cos(yaw), s = sin(yaw);
        vec3 p = vec3(loc.x*c + loc.z*s, loc.y, -loc.x*s + loc.z*c);

        // ===== ANGIN =====
        vec2 wd = normalize(vec2(1.0,0.35));
        float ph = dot(xz, wd);
        float g  = 0.5+0.5*sin(ph*0.42 - uTime*1.5 + sin(xz.y*0.17+uTime*0.35)*1.6);
        float g2 = 0.5+0.5*sin(ph*1.30 - uTime*2.6 + seed*6.28);
        float strength = (0.10 + g*0.60 + g2*0.12) * uWind;
        float bend = strength * y*y * H;
        p.xz += wd * bend;
        p.xz += vec2(-wd.y,wd.x) * sin(uTime*1.7 + seed*40.0 + ph*0.8) * 0.07*y*y*H*uWind;
        p.y  -= bend*0.35*y;

        vec3 world = vec3(xz.x, gy, xz.y) + p;

        // ===== KURSOR = ANGIN =====
        vec2 d = world.xz - uMouse;
        float dist = length(d)+0.0001;
        float push = (1.0 - smoothstep(0.0, 2.4, dist)) * uMouseOn;
        world.xz += d/dist * push * 0.85 * y*y*H;
        world.y  -= push * 0.45 * y * H;

        // ===== WARNA =====
        float r1 = fract(seed*7.3), r2 = fract(seed*3.7), r3 = fract(seed*11.1);
        vec3 root = mix(vec3(0.02,0.20,0.05), vec3(0.06,0.32,0.07), r1);
        vec3 mid  = mix(vec3(0.14,0.56,0.09), vec3(0.30,0.68,0.10), r2);
        vec3 tip  = mix(vec3(0.55,0.86,0.20), vec3(0.80,0.93,0.32), r3);
        vec3 col = y<0.5 ? mix(root,mid,y*2.0) : mix(mid,tip,(y-0.5)*2.0);
        float light = clamp(dot(n, normalize(vec3(0.5,0.75,0.35)))*0.65+0.5, 0.2, 1.15);
        col *= light;
        col *= 1.0 - abs(position.x)*0.55*(1.0-y*0.6);
        col += vec3(0.10,0.13,0.0) * g * y;

        vCol = col;
        vec4 mv = viewMatrix*vec4(world,1.0);
        vFogF = 1.0 - exp(-pow(length(mv.xyz)*uFogD,2.0));
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uFog; varying vec3 vCol; varying float vFogF;
      void main(){ gl_FragColor = vec4(mix(vCol,uFog,vFogF),1.0); }`,
  });

  const tiers = []; // {mesh, max}
  function makeTier({ count, x0, x1, z0, z1, hMin, hMax, wMin, wMax, farScale = 0, seed = 1 }) {
    const rnd = mulberry32(seed);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(bladeBase.pos, 3));
    geo.setIndex(bladeBase.idx);
    const off = new Float32Array(count * 3), par = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      const dist = Math.hypot(x, z - 10);
      const sc = 1 + dist * farScale;
      off[i * 3] = x; off[i * 3 + 1] = z; off[i * 3 + 2] = rnd();
      par[i * 4] = (hMin + rnd() * (hMax - hMin)) * sc;
      par[i * 4 + 1] = (wMin + rnd() * (wMax - wMin)) * sc;
      par[i * 4 + 2] = rnd() * Math.PI * 2;
      par[i * 4 + 3] = (rnd() - 0.35) * 0.55;
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
    geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(par, 4));
    geo.instanceCount = Math.floor(count * quality);
    const mesh = new THREE.Mesh(geo, grassMat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    tiers.push({ mesh, max: count });
  }
  const N = (n) => Math.floor(n * (isMobile ? 0.7 : 1));
  makeTier({ count: N(130000), x0: -15, x1: 15, z0: -10, z1: 16, hMin: 0.45, hMax: 1.05, wMin: 0.032, wMax: 0.058, seed: 11 });
  makeTier({ count: N(110000), x0: -40, x1: 40, z0: -50, z1: -6, hMin: 0.7, hMax: 1.4, wMin: 0.09, wMax: 0.16, farScale: 0.012, seed: 22 });
  makeTier({ count: N(80000), x0: -95, x1: 95, z0: -120, z1: -45, hMin: 1.0, hMax: 2.0, wMin: 0.2, wMax: 0.4, farScale: 0.02, seed: 33 });

  /* -------- awan pompom -------- */
  const puff = puffTexture();
  const clouds = [];
  function makeCloud(x, y, z, size, seed) {
    const rnd = mulberry32(seed), grp = new THREE.Group();
    const n = 11;
    for (let i = 0; i < n; i++) {
      const u = rnd(), v = rnd();
      const px = (u - 0.5) * size * 1.6, py = (v - 0.45) * size * 0.55, pz = (rnd() - 0.5) * size * 0.4;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, fog: false, color: new THREE.Color().setHSL(0.58, 0.55, 0.78 + v * 0.22) }));
      const s = size * (0.45 + rnd() * 0.4); sp.scale.set(s, s * 0.85, 1);
      sp.position.set(px, py, pz); sp.renderOrder = -5;
      grp.add(sp);
    }
    grp.position.set(x, y, z); grp.userData = { speed: 0.25 + rnd() * 0.35, range: 220 };
    scene.add(grp); clouds.push(grp);
  }
  [[-60, 30, -120, 26], [20, 38, -150, 34], [75, 26, -110, 22], [-110, 44, -170, 40], [-20, 22, -95, 18], [55, 52, -190, 40], [-85, 20, -80, 16]]
    .forEach((c, i) => makeCloud(c[0], c[1], c[2], c[3], 100 + i));
  // pompom rendah yang nongkrong di bukit
  makeCloud(-9, hillJS(-9, -14) + 2.2, -14, 5.5, 301);
  makeCloud(16, hillJS(16, -26) + 3.4, -26, 8, 302);

  /* -------- doodle melayang + daisy tanah -------- */
  const atlas = doodleAtlas();
  const petalCount = isMobile ? 38 : 70;
  const petalGeo = new THREE.BufferGeometry();
  {
    const rnd = mulberry32(77);
    const base = new Float32Array(petalCount * 3), attrs = new Float32Array(petalCount * 4);
    for (let i = 0; i < petalCount; i++) {
      base[i * 3] = (rnd() - 0.5) * 50; base[i * 3 + 1] = 0.6 + rnd() * 8; base[i * 3 + 2] = -38 + rnd() * 38;
      attrs[i * 4] = rnd(); attrs[i * 4 + 1] = Math.floor(rnd() * 8); attrs[i * 4 + 2] = 0.6 + rnd() * 0.9; attrs[i * 4 + 3] = (rnd() - 0.5) * 2.2;
    }
    petalGeo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    petalGeo.setAttribute('aA', new THREE.BufferAttribute(attrs, 4)); // seed, tile, size, spin
  }
  const petalMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAtlas: { value: atlas }, uPR: { value: 1 }, uOp: { value: 1 }, uWind: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime, uPR, uWind; attribute vec4 aA;
      varying float vTile, vSpin, vSeed;
      ${HILL_GLSL}
      void main(){
        vec3 p = position;
        float sp = (0.6 + aA.x*1.2) * uWind;
        p.x = mod(p.x + uTime*sp + 25.0, 50.0) - 25.0;
        p.z += sin(uTime*0.4 + aA.x*20.0)*1.2;
        float gy = hillH(p.xz);
        p.y = gy + position.y + sin(uTime*0.9 + aA.x*30.0)*0.6;
        vec4 mv = viewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = min(aA.z * 46.0 * uPR * (14.0 / max(-mv.z, 1.0)), 64.0*uPR);
        vTile = aA.y; vSpin = uTime*aA.w; vSeed = aA.x;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float; uniform sampler2D uAtlas; uniform float uOp;
      varying float vTile, vSpin, vSeed;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float c = cos(vSpin), s = sin(vSpin);
        uv = vec2(uv.x*c - uv.y*s, uv.x*s + uv.y*c) + 0.5;
        if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) discard;
        vec2 t = vec2(mod(vTile,4.0), floor(vTile/4.0));
        vec4 col = texture2D(uAtlas, vec2((t.x+uv.x)/4.0, 1.0-(t.y+1.0-uv.y)/2.0));
        if(col.a<0.05) discard;
        gl_FragColor = vec4(col.rgb, col.a*uOp);
      }`,
  });
  const petals = new THREE.Points(petalGeo, petalMat); petals.frustumCulled = false; petals.renderOrder = 4;
  scene.add(petals);

  const daisyCount = isMobile ? 260 : 520;
  const daisyGeo = new THREE.BufferGeometry();
  {
    const rnd = mulberry32(99), pos = new Float32Array(daisyCount * 3), a = new Float32Array(daisyCount);
    for (let i = 0; i < daisyCount; i++) {
      const x = (rnd() - 0.5) * 70, z = -55 + rnd() * 70;
      pos[i * 3] = x; pos[i * 3 + 1] = hillJS(x, z) + 0.28 + rnd() * 0.25; pos[i * 3 + 2] = z; a[i] = rnd();
    }
    daisyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    daisyGeo.setAttribute('aS', new THREE.BufferAttribute(a, 1));
  }
  const daisyMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTex: { value: daisyTexture() }, uPR: { value: 1 }, uTime: { value: 0 }, uFog: { value: FOG_COLOR }, uFogD: { value: FOG_DENSITY } },
    vertexShader: /* glsl */ `
      uniform float uPR, uTime, uFogD; attribute float aS; varying float vF;
      void main(){
        vec3 p = position; p.x += sin(uTime*1.2+aS*30.0)*0.05;
        vec4 mv = viewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = (0.65+aS*0.5) * 40.0 * uPR * (10.0/max(-mv.z,1.0));
        vF = 1.0 - exp(-pow(length(mv.xyz)*uFogD,2.0));
      }`,
    fragmentShader: /* glsl */ `
      precision highp float; uniform sampler2D uTex; uniform vec3 uFog; varying float vF;
      void main(){ vec4 c = texture2D(uTex, gl_PointCoord); if(c.a<0.1) discard; gl_FragColor = vec4(mix(c.rgb,uFog,vF*0.8), c.a); }`,
  });
  const daisies = new THREE.Points(daisyGeo, daisyMat); daisies.frustumCulled = false;
  scene.add(daisies);

  /* -------- LOGO: bulu-bulu plush, ditumpuk berlapis biar ada ketebalan -------- */
  const logoGroup = new THREE.Group();
  const logoPivot = new THREE.Group();
  logoGroup.add(logoPivot);
  scene.add(logoGroup);
  const loader = new THREE.TextureLoader();
  const logoAspect = 287 / 1157;
  const ready = new Promise((resolve) => {
    loader.load(opts.logoSrc || 'assets/img/logo-fuzzy.webp', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const geo = new THREE.PlaneGeometry(1, logoAspect);
      const layers = 16;
      const gl = renderer.getContext();
      const msaa = !isMobile && gl.getParameter(gl.SAMPLES) > 1; // alpha-to-coverage cuma halus kalau ada MSAA
      const front = new THREE.Color('#ffffff'), back = new THREE.Color('#6fa85c');
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1);
        const mat = new THREE.MeshBasicMaterial({
          map: tex, alphaTest: msaa ? 0.06 : 0.4, alphaToCoverage: msaa, side: THREE.DoubleSide,
          color: i === 0 ? front : new THREE.Color('#f1fbe8').lerp(back, Math.pow(t, 0.8)),
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.z = -i * 0.0042; m.renderOrder = 3;
        logoPivot.add(m);
      }
      resolve();
    }, undefined, () => resolve());
  });

  /* -------- resize / pointer -------- */
  let W = 1, H = 1, aspect = 1, logoBase = 12;
  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    aspect = W / H;
    const pr = Math.min(window.devicePixelRatio || 1, maxDPR);
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    camera.aspect = aspect; camera.fov = aspect < 0.9 ? 66 : 52; camera.updateProjectionMatrix();
    petalMat.uniforms.uPR.value = pr; daisyMat.uniforms.uPR.value = pr;
    // lebar logo ~ 62% layar (di HP ~ 86%)
    const dist = 16, visW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    logoBase = Math.min(visW * (aspect < 0.9 ? 1.0 : 0.7), 22);
  }
  window.addEventListener('resize', () => { resize(); if (!active) { update(0.016, clock.elapsedTime); renderer.render(scene, camera); } });

  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let mouseTimer = 0;
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    mouse.on = 1; clearTimeout(mouseTimer); mouseTimer = setTimeout(() => (mouse.on = 0), 900);
  }, { passive: true });

  /* -------- loop -------- */
  const clock = new THREE.Clock();
  let active = false, running = false, frames = 0, accum = 0, tuned = 0;
  const camPos = new THREE.Vector3();

  function update(dt, t) {
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);

    // kamera
    const gx = mouse.x * 0.9;
    const ground = hillJS(gx, state.camZ);
    camPos.set(gx, ground + state.camY, state.camZ);
    camera.position.copy(camPos);
    camera.rotation.set(state.pitch + mouse.y * 0.035, -mouse.x * 0.05, 0);
    camera.updateMatrixWorld();

    // titik kursor di tanah
    ray.setFromCamera({ x: mouse.x, y: mouse.y }, camera);
    plane.constant = -(ground + 0.25);
    if (ray.ray.intersectPlane(plane, hit)) { mouse.worldX = hit.x; mouse.worldZ = hit.z; }
    grassUniforms.uMouse.value.set(mouse.worldX, mouse.worldZ);
    grassUniforms.uMouseOn.value += (mouse.on - grassUniforms.uMouseOn.value) * Math.min(1, dt * 4);

    // uniform waktu
    grassUniforms.uTime.value = t; grassUniforms.uWind.value = state.wind;
    skyMat.uniforms.uTime.value = t; petalMat.uniforms.uTime.value = t; daisyMat.uniforms.uTime.value = t;
    petalMat.uniforms.uOp.value = state.petals; petalMat.uniforms.uWind.value = state.wind;
    sky.position.copy(camPos);

    // awan geser pelan
    clouds.forEach((c) => { c.position.x += c.userData.speed * dt * state.wind; if (c.position.x > 130) c.position.x = -130; });

    // logo
    const gl = hillJS(0, state.logoZ);
    const bob = Math.sin(t * 1.3) * 0.2;
    logoGroup.position.set(0, gl + state.logoY + bob, state.logoZ);
    logoGroup.scale.setScalar(Math.max(0.0001, logoBase * state.logoScale * state.logoIntro * (1 + state.logoPop)));
    logoPivot.rotation.set(mouse.y * -0.12 + Math.sin(t * 0.8) * 0.04, Math.sin(t * 0.7) * 0.32 + mouse.x * 0.28 + state.logoSpin + state.logoKick, Math.sin(t * 0.9) * 0.03 + state.logoRoll);
  }

  function frame() {
    if (!active) { running = false; return; }
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    update(dt, t);
    renderer.render(scene, camera);

    // auto-tuning kualitas
    if (tuned < 2 && t > 1.2) {
      accum += dt; frames++;
      if (frames >= 90) {
        const avg = accum / frames; accum = 0; frames = 0;
        if (avg > 0.026) { tuned++; quality = Math.max(0.25, quality * 0.6); maxDPR = Math.max(1, maxDPR - 0.5); applyQuality(); resize(); }
        else tuned = 2;
      }
    }
  }
  function applyQuality() { tiers.forEach((t) => (t.mesh.geometry.instanceCount = Math.floor(t.max * quality))); }

  function setActive(v) {
    active = v;
    if (v && !running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
  }

  resize();
  update(0.016, 0); renderer.render(scene, camera);

  return {
    state, ready, setActive, resize, renderer,
    spin() { /* dipanggil main.js, di-tween pakai GSAP */ },
    get isMobile() { return isMobile; },
  };
}

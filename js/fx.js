/* ==========================================================================
   fx.js — jejak spidol di kursor + confetti doodle
   (satu kanvas transparan di atas semua; cuma nge-render kalau ada isinya)
   ========================================================================== */
const COLORS = ['#ff3b6b', '#ff9a1f', '#ffd60a', '#2fb344', '#2a7fff', '#8b3dff'];
let canvas, ctx, W = 0, H = 0, dpr = 1, raf = 0;
const trail = [];      // {x, y, c, t}
const bits = [];       // confetti
let last = null, dist = 0, colorIdx = 0;
let enabled = true;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function heart(c, s) { c.beginPath(); c.moveTo(0, s * .9); c.bezierCurveTo(-s * 1.4, -s * .1, -s * .7, -s * 1.1, 0, -s * .35); c.bezierCurveTo(s * .7, -s * 1.1, s * 1.4, -s * .1, 0, s * .9); c.closePath(); }
function star(c, s) { c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * .45 : s * 1.05; const x = Math.cos(a) * r, y = Math.sin(a) * r; k ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); }
function squig(c, s) { c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(-s * .5, -s * .9, 0, 0); c.quadraticCurveTo(s * .5, s * .9, s, 0); }
function dot(c, s) { c.beginPath(); c.arc(0, 0, s * .6, 0, Math.PI * 2); }
const SHAPES = [heart, star, squig, dot, heart, star];

function loop() {
  raf = 0;
  ctx.clearRect(0, 0, W, H);
  const now = performance.now();

  // jejak
  while (trail.length && now - trail[0].t > 650) trail.shift();
  if (trail.length > 1) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      if (b.brk) continue;
      const age = (now - b.t) / 650, al = Math.max(0, 1 - age);
      ctx.globalAlpha = al * .9;
      ctx.strokeStyle = b.c; ctx.lineWidth = 3 + 9 * al;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // tekstur krayon: garis tipis, geser dikit
      ctx.globalAlpha = al * .35; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x + 3, a.y - 2); ctx.lineTo(b.x + 3, b.y - 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // confetti
  for (let i = bits.length - 1; i >= 0; i--) {
    const p = bits[i];
    p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 1;
    if (p.life <= 0 || p.y > H + 40) { bits.splice(i, 1); continue; }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
    ctx.globalAlpha = Math.min(1, p.life / 24);
    p.shape(ctx, p.s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (p.shape === squig) { ctx.lineWidth = 5; ctx.strokeStyle = p.c; ctx.stroke(); }
    else { ctx.fillStyle = p.c; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1d1410'; ctx.stroke(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (trail.length || bits.length) raf = requestAnimationFrame(loop);
}
function wake() { if (!raf) raf = requestAnimationFrame(loop); }

export function burst(x, y, n = 28) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 9;
    bits.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6, r: Math.random() * 6, vr: (Math.random() - .5) * .35,
      s: 9 + Math.random() * 11, c: COLORS[(Math.random() * COLORS.length) | 0], shape: SHAPES[(Math.random() * SHAPES.length) | 0],
      life: 70 + Math.random() * 40,
    });
  }
  wake();
}

export function initFX() {
  canvas = document.getElementById('crayon');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize(); window.addEventListener('resize', resize);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) enabled = false;

  window.addEventListener('pointermove', (e) => {
    if (!enabled || e.pointerType !== 'mouse') return;
    const p = { x: e.clientX, y: e.clientY, t: performance.now(), c: COLORS[colorIdx] };
    if (last) { dist += Math.hypot(p.x - last.x, p.y - last.y); if (dist > 90) { dist = 0; colorIdx = (colorIdx + 1) % COLORS.length; } }
    p.c = COLORS[colorIdx];
    trail.push(p); last = p; wake();
  }, { passive: true });
  window.addEventListener('pointerleave', () => { last = null; });
  // di HP: tap = percikan kecil
  window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && enabled && !e.target.closest('a,button')) burst(e.clientX, e.clientY, 8); }, { passive: true });
}

/* ==========================================================================
   TOLD HER — main.js
   Orkestrasi semua animasi scroll (GSAP + ScrollTrigger + Lenis).
   Urutan halaman:
     loader -> HERO (rumput 3D) -> CERITA (blob) -> CORETAN (hijau, pinned)
     -> pita marquee -> LOOKBOOK (geser samping) -> DUA WARNA (putih->merah)
     -> DROP -> VERIFIKASI -> FOOTER
   ========================================================================== */
import { createGrass } from './grass.js';
import { initFX, burst } from './fx.js';
import { LINKS, WANT_MESSAGES } from './config.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const pick = (a) => a[(Math.random() * a.length) | 0];

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
root.classList.add('loading');
document.body.classList.add('in-stage');

/* -------------------------------------------------------------------------
   Toast kecil
   ------------------------------------------------------------------------- */
const toastEl = $('#toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* -------------------------------------------------------------------------
   Smooth scroll (Lenis) <-> ScrollTrigger
   ------------------------------------------------------------------------- */
let lenis = null;
if (!reduced && typeof Lenis !== 'undefined') {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop(); // dikunci dulu sampai loader beres
}
const scrollToEl = (target, opts = {}) => {
  if (lenis) lenis.scrollTo(target, { duration: 2, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
  else (typeof target === 'number' ? window.scrollTo({ top: target, behavior: 'smooth' }) : target.scrollIntoView({ behavior: 'smooth' }));
};
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#kontak' && a.dataset.link) return; // link sosmed di footer ditangani terpisah
    const el = id === '#top' ? 0 : $(id);
    if (el === null) return;
    e.preventDefault();
    scrollToEl(el);
  });
});

/* -------------------------------------------------------------------------
   Rumput 3D
   ------------------------------------------------------------------------- */
let grass = null;
try {
  const qParam = new URLSearchParams(location.search).get('q'); // ?q=0.3 -> buat debug: kurangi jumlah rumput
  grass = createGrass($('#grass'), qParam ? { quality: +qParam } : {});
} catch (err) {
  console.warn('[told her] WebGL nggak jalan, pakai tampilan cadangan.', err);
  root.classList.add('no-webgl');
}
const S = grass ? grass.state : {};

/* -------------------------------------------------------------------------
   LOADER: fonts + gambar + rumput
   ------------------------------------------------------------------------- */
const loaderEl = $('#loader'), pctEl = $('#loaderPct'), barEl = $('#loaderBar');
const prog = { v: 0 };
let target = 0;
const setTarget = (n) => { target = Math.max(target, n); gsap.to(prog, { v: target, duration: 0.6, ease: 'power2.out', onUpdate: () => { const p = Math.round(prog.v); pctEl.textContent = p + '%'; barEl.style.width = p + '%'; } }); };

$$('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
const imgs = $$('img').filter((i) => !i.closest('.loader'));
const tasks = [
  document.fonts ? document.fonts.ready : Promise.resolve(),
  Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))),
  grass ? grass.ready : Promise.resolve(),
];
let done = 0;
tasks.forEach((p) => p.then(() => { done++; setTarget(Math.round((done / tasks.length) * 100)); }));
setTarget(8);

const minWait = new Promise((r) => setTimeout(r, reduced ? 200 : 1500));
Promise.all([...tasks, minWait]).then(start, start);

/* -------------------------------------------------------------------------
   START: dipanggil begitu semua siap
   ------------------------------------------------------------------------- */
let started = false;
function start() {
  if (started) return; // jangan pernah jalan dua kali
  started = true;
  setTarget(100);
  try { buildAll(); } catch (err) { console.error('[toldher] buildAll error:', err); }
  ScrollTrigger.refresh();
  if (grass) grass.setActive(true);

  setTimeout(() => {
    loaderEl.classList.add('is-done');
    root.classList.remove('loading');
    if (lenis) lenis.start();
    intro();
  }, 450);
}

function intro() {
  gsap.from('.nav .pill', { y: -40, opacity: 0, rotate: -6, duration: 0.8, stagger: 0.07, ease: 'back.out(1.8)', delay: 0.5 });
  gsap.from('.hero__tag', { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 1.0 });
  gsap.from('.hero__cue', { opacity: 0, duration: 0.8, delay: 1.5 });
  gsap.from('.hero__ticker', { y: 70, duration: 0.8, ease: 'power3.out', delay: 1.1 });
  if (grass) {
    S.logoIntro = 0; S.logoKick = -Math.PI * 2;
    gsap.to(S, { logoIntro: 1, duration: 1.8, ease: 'elastic.out(1, 0.5)', delay: 0.35 });
    gsap.to(S, { logoKick: 0, duration: 1.8, ease: 'power3.out', delay: 0.35 });
  } else {
    gsap.from('.hero__fallback', { scale: 0.6, opacity: 0, duration: 1.2, ease: 'elastic.out(1,.5)' });
  }
}

/* ==========================================================================
   BUILD: semua ScrollTrigger dibikin di sini
   ========================================================================== */
function buildAll() {
  initFX();
  heroTimeline();
  stageToggle();
  ceritaBlob();
  coretan();
  ribbons();
  lookbook();
  warna();
  dropSection();
  verifySection();
  footer();
  heroClick();
}

/* ---------- aktifkan/matiin render WebGL sesuai posisi scroll ---------- */
function stageToggle() {
  if (!grass) return;
  ScrollTrigger.create({
    trigger: '#stage', start: 'top bottom', end: 'bottom top',
    onToggle: (self) => { grass.setActive(self.isActive); document.body.classList.toggle('in-stage', self.isActive); },
  });
}

/* ---------- HERO: kamera terbang dari langit ke dalam rumput ---------- */
function heroTimeline() {
  const lineIn = (sel, at) => ({ sel, at });
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 0.9 },
  });

  tl.to('.hero__bottom', { opacity: 0, y: -40, duration: 0.7 }, 0.2);

  if (grass) {
    tl.to(S, { pitch: 0.8, camY: 2.4, logoY: 7.6, logoScale: 0.82, duration: 2.4, ease: 'power2.inOut' }, 0.9)
      .to(S, { logoSpin: Math.PI * 2, duration: 2.8, ease: 'power2.inOut' }, 0.9)
      .to(S, { wind: 1.5, duration: 1.5 }, 2);
  }

  const lines = [['a', 2.0, 3.4], ['b', 3.7, 5.1], ['c', 5.4, 7.0]];
  lines.forEach(([k, a, b]) => {
    tl.fromTo(`[data-line="${k}"]`, { opacity: 0, y: 70, scale: 0.88, rotate: k === 'b' ? 2 : -2 }, { opacity: 1, y: 0, scale: 1, rotate: k === 'b' ? -1.5 : 1, duration: 0.7, ease: 'back.out(1.4)' }, a)
      .to(`[data-line="${k}"]`, { opacity: 0, y: -70, scale: 1.05, duration: 0.6, ease: 'power2.in' }, b);
  });

  if (grass) {
    tl.to(S, { pitch: -0.1, camY: 1.15, camZ: 5.5, logoY: 22, logoScale: 0.3, logoRoll: 0.7, wind: 2.1, petals: 0.55, duration: 3.1, ease: 'power2.inOut' }, 7.0);
  }
  tl.to('.hero__ticker', { yPercent: 100, duration: 0.7 }, 7.6);
  tl.to({}, { duration: 0.2 }, 10.1); // sedikit tahan di akhir
}

/* ---------- klik di hero: logo muter + percikan ---------- */
function heroClick() {
  window.addEventListener('click', (e) => {
    if (window.scrollY > window.innerHeight * 1.1) return;
    if (e.target.closest('a,button,.nav')) return;
    burst(e.clientX, e.clientY, 18);
    if (grass) {
      gsap.fromTo(S, { logoKick: 0 }, { logoKick: Math.PI * 2, duration: 1.5, ease: 'back.inOut(1.3)', overwrite: 'auto' });
      gsap.timeline().to(S, { logoPop: 0.14, duration: 0.2, ease: 'power2.out' }).to(S, { logoPop: 0, duration: 0.8, ease: 'elastic.out(1,.4)' });
    }
  });
}

/* ---------- CERITA: blob yang goyang + teks muncul per kata ---------- */
function ceritaBlob() {
  const text = $('#blobText');
  const words = text.textContent.trim().split(/\s+/);
  text.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');

  gsap.to('.blob__text .w', {
    opacity: 1, stagger: 0.06, ease: 'none',
    scrollTrigger: { trigger: '#cerita', start: 'top 55%', end: 'top -55%', scrub: true },
  });
  gsap.from('.blob__sticker', {
    scale: 0, rotate: -40, stagger: 0.12, duration: 0.8, ease: 'back.out(2.4)',
    scrollTrigger: { trigger: '#cerita', start: 'top 55%' },
  });
  gsap.from('.blobwrap', {
    y: 140, rotate: 3, ease: 'none',
    scrollTrigger: { trigger: '#cerita', start: 'top bottom', end: 'top 25%', scrub: true },
  });

  // path blob (Catmull-Rom -> bezier), diganti-ganti tiap ~30fps pas kelihatan
  const bp = $('#blobPath'), bs = $('#blobShadow');
  const N = 11, base = Array.from({ length: N }, (_, i) => 0.93 + ((i * 7919) % 13) / 100);
  const make = (t) => {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = base[i] + 0.045 * Math.sin(t * 0.9 + i * 1.7) + 0.03 * Math.sin(t * 1.4 + i * 0.6);
      pts.push([400 + Math.cos(a) * 385 * r, 280 + Math.sin(a) * 262 * r]);
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  };
  bp.setAttribute('d', make(0)); bs.setAttribute('d', make(0)); bs.setAttribute('transform', 'translate(0 14)');
  let on = false, acc = 0;
  ScrollTrigger.create({ trigger: '#cerita', start: 'top bottom', end: 'bottom top', onToggle: (s) => (on = s.isActive) });
  gsap.ticker.add((time, dt) => {
    if (!on || reduced) return;
    acc += dt; if (acc < 33) return; acc = 0;
    const d = make(time);
    bp.setAttribute('d', d); bs.setAttribute('d', d);
  });
}

/* ---------- CORETAN: teks spidol "ditulis", doodle digambar, foto nempel ---------- */
function coretan() {
  const sec = $('#coretan');

  // siapin garis doodle buat efek "digambar"
  $$('.scribble__pin .dd .draw').forEach((p) => {
    const len = Math.ceil(p.getTotalLength());
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
  });

  // animasi "boil" (garis goyang) cuma jalan kalau section ini kelihatan
  const turb = $('#boilTurb'); let boil = 0;
  ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: 'bottom top',
    onToggle: (s) => {
      clearInterval(boil);
      if (s.isActive && !reduced) boil = setInterval(() => turb.setAttribute('seed', (Math.random() * 100) | 0), 140);
    },
  });

  gsap.set('.pol-1', { yPercent: 160, rotate: -22, opacity: 0 });
  gsap.set('.pol-2', { xPercent: 160, rotate: 25, opacity: 0 });
  gsap.set('.orange', { scale: 0, rotate: -50 });
  gsap.set('.scribble__small, .scribble__menu', { opacity: 0 });

  const hide = 'inset(-12% 100% -12% 0)', full = 'inset(-12% 0% -12% 0)', gone = 'inset(-12% 0% -12% 100%)';
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: sec, start: 'top top', end: '+=560%', pin: '.scribble__pin', scrub: 0.7, anticipatePin: 1 },
  });

  tl.to('.scribble__small--l, .scribble__menu', { opacity: 1, duration: 0.6 }, 0.1)
    .to('.draw[data-d="a"]', { strokeDashoffset: 0, duration: 1.5, stagger: 0.25 }, 0.2)

    // beat 1
    .to('[data-beat="1"]', { clipPath: full, duration: 1.5 }, 0.7)
    .to('.pol-1', { yPercent: 0, rotate: -5, opacity: 1, duration: 1.2, ease: 'back.out(1.5)' }, 1.9)

    // beat 1 -> 2
    .to('[data-beat="1"]', { clipPath: gone, duration: 0.9 }, 4.0)
    .to('.scribble__small--r', { opacity: 1, duration: 0.4 }, 4.1)
    .to('[data-beat="2"]', { clipPath: full, duration: 1.5 }, 4.3)
    .to('.pol-2', { xPercent: 0, rotate: 4, opacity: 1, duration: 1.2, ease: 'back.out(1.4)' }, 4.8)
    .to('.draw[data-d="b"]', { strokeDashoffset: 0, duration: 1.6, stagger: 0.3 }, 4.6)
    .to('.orange', { scale: 1, rotate: 8, duration: 0.9, ease: 'back.out(2.4)' }, 5.6)

    // beat 2 -> 3
    .to('[data-beat="2"]', { clipPath: gone, duration: 0.9 }, 7.6)
    .to('[data-beat="3"]', { clipPath: full, duration: 1.4 }, 8.0)
    .to('.pol-1', { x: '-3vw', y: '3vh', rotate: -11, scale: 0.9, duration: 1.2 }, 8.0)
    .to('.pol-2', { x: '3vw', y: '4vh', rotate: 9, scale: 0.92, duration: 1.2 }, 8.0)
    .to('.draw[data-d="c"]', { strokeDashoffset: 0, duration: 1.4, stagger: 0.3 }, 8.2)

    // penutup: semua melayang keluar pelan-pelan
    .to({}, { duration: 1.6 }, 9.6)
    .to('.pol-1', { yPercent: -30, opacity: 0.0, duration: 0.8 }, 10.4)
    .to('.pol-2', { yPercent: 30, opacity: 0.0, duration: 0.8 }, 10.4);

  // pointer menu (kayak daftar "about / item / sale" di referensi) turun mengikuti scroll
  const items = $$('.scribble__menu li'), ptr = $('.scribble__menu .ptr'), menu = $('.scribble__menu');
  const px = { i: 0 };
  const movePtr = () => {
    const idx = Math.round(px.i);
    items.forEach((li, k) => li.classList.toggle('is-on', k === idx));
    const li = items[idx];
    if (li) {
      const pb = ptr.getBoundingClientRect(); // (SVG nggak punya offsetWidth)
      gsap.set(ptr, { x: li.offsetLeft - pb.width - 14, y: li.offsetTop + li.offsetHeight / 2 - pb.height / 2 });
    }
  };
  tl.to(px, { i: items.length - 1, duration: 10.2, onUpdate: movePtr }, 0.6);
  movePtr();
}

/* ---------- PITA marquee: ngebut kalau di-scroll cepet ---------- */
function ribbons() {
  const tweens = $$('.ribbon').map((r, i) => {
    const tr = $('.ribbon__track', r);
    return gsap.fromTo(tr, { xPercent: i ? -50 : 0 }, { xPercent: i ? 0 : -50, ease: 'none', duration: 30, repeat: -1 });
  });
  let ts = 1;
  gsap.ticker.add(() => {
    const v = lenis ? lenis.velocity : 0;
    const want = 1 + Math.max(-10, Math.min(10, v * 0.22));
    ts += (want - ts) * 0.08;
    tweens.forEach((t) => t.timeScale(ts));
  });
}

/* ---------- LOOKBOOK: geser ke samping pas scroll ---------- */
function lookbook() {
  const track = $('#lbTrack'), bar = $('#lbBar'), now = $('#lbNow');
  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  const cards = $$('.card');

  const tween = gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '#lookbook', start: 'top top', end: () => '+=' + dist(), pin: '.lb__pin', scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (self) => {
        bar.style.width = (self.progress * 100).toFixed(1) + '%';
        const i = Math.min(cards.length, Math.floor(self.progress * cards.length) + 1);
        now.textContent = String(i).padStart(2, '0');
      },
    },
  });

  // parallax gambar di dalam kartu + goyang pas kartu lewat tengah
  cards.forEach((c) => {
    const img = $('img', c);
    gsap.fromTo(img, { xPercent: 7 }, { xPercent: -7, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    gsap.fromTo(c, { y: 30 }, { y: -30, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
  });

  // miring dikit sesuai kecepatan scroll
  if (lenis && !reduced) {
    const setSkew = gsap.quickSetter(track, 'skewX', 'deg');
    let sk = 0;
    gsap.ticker.add(() => {
      sk += (Math.max(-5, Math.min(5, -lenis.velocity * 0.25)) - sk) * 0.1;
      setSkew(sk);
    });
  }

  gsap.from('.lb__title', { y: 60, rotate: -4, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '#lookbook', start: 'top 70%' } });
}

/* ---------- DUA WARNA: lingkaran merah melebar ---------- */
function warna() {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#warna', start: 'top top', end: '+=240%', pin: '.warna__pin', scrub: 0.7, anticipatePin: 1 },
  });
  // masuknya pakai trigger biasa (bukan scrub) supaya layar nggak kosong pas section baru nongol
  gsap.from('.warna__layer--white .warna__title', { y: 80, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '#warna', start: 'top 70%' } });
  gsap.from('.warna__layer--white .warna__arts figure', { y: 120, rotate: (i) => (i ? 8 : -8), opacity: 0, stagger: 0.12, duration: 1, ease: 'back.out(1.4)', scrollTrigger: { trigger: '#warna', start: 'top 60%' } });
  tl.to({}, { duration: 0.5 })
    .to('#warnaRed', { clipPath: 'circle(150% at 50% 64%)', duration: 1.5, ease: 'power2.inOut' })
    .from('.warna__layer--red .warna__arts figure', { scale: 0.85, rotate: (i) => (i ? -6 : 6), stagger: 0.1, duration: 0.8, ease: 'back.out(1.6)' }, '<0.4')
    .to({}, { duration: 0.6 });

  $$('.warna__arts figure').forEach((f, i) => {
    f.addEventListener('pointerenter', () => gsap.to(f, { rotate: i ? 4 : -4, scale: 1.04, duration: 0.4, ease: 'back.out(2)' }));
    f.addEventListener('pointerleave', () => gsap.to(f, { rotate: 0, scale: 1, duration: 0.5, ease: 'power3.out' }));
  });
}

/* ---------- DROP ---------- */
function dropSection() {
  gsap.to('#dropPoster', { y: -50, ease: 'none', scrollTrigger: { trigger: '#drop', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.drop__art', { rotate: -2, y: 40 }, { rotate: 14, y: -30, ease: 'none', scrollTrigger: { trigger: '#drop', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.drop__copy > *', { y: 60, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '.drop__copy', start: 'top 78%' } });

  const btn = $('#wantBtn');
  let n = 0;
  btn.addEventListener('click', () => {
    const r = btn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 44);
    toast(WANT_MESSAGES[n++ % WANT_MESSAGES.length]);
  });

  // poster miring ngikutin kursor (cuma di desktop)
  if (!coarse) {
    const poster = $('#dropPoster');
    const rx = gsap.quickTo(poster, 'rotationY', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(poster, 'rotationX', { duration: 0.6, ease: 'power3' });
    gsap.set(poster, { transformPerspective: 900 });
    poster.addEventListener('pointermove', (e) => {
      const b = poster.getBoundingClientRect();
      rx(((e.clientX - b.left) / b.width - 0.5) * 12); ry(-((e.clientY - b.top) / b.height - 0.5) * 10);
    });
    poster.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
}

/* ---------- VERIFIKASI (captcha iseng) ---------- */
function verifySection() {
  gsap.from('.verify__img', { y: 100, rotate: -16, opacity: 0, duration: 1, ease: 'back.out(1.5)', scrollTrigger: { trigger: '#verify', start: 'top 70%' } });
  gsap.from('.verify__copy > *', { y: 50, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '#verify', start: 'top 65%' } });

  const img = $('#captchaImg');
  img.addEventListener('click', () => { img.classList.remove('shake'); void img.offsetWidth; img.classList.add('shake'); });

  const yes = $('[data-answer="yes"]'), no = $('#noBtn');
  yes.addEventListener('click', () => {
    const r = yes.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 60);
    toast('noted. you have good taste ♥');
  });

  // tombol "cuma lewat" kabur (maksimal 5x, abis itu pasrah)
  let dodge = 0;
  no.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || dodge >= 5) return;
    dodge++;
    gsap.to(no, { x: gsap.utils.random(-160, 160), y: gsap.utils.random(-70, 70), rotate: gsap.utils.random(-14, 14), duration: 0.45, ease: 'back.out(2)' });
  });
  no.addEventListener('click', () => {
    toast(dodge >= 5 ? 'fair. thanks for stopping by.' : 'wait, come back. try again.');
    gsap.to(no, { x: 0, y: 0, rotate: 0, duration: 0.5, ease: 'power3.out' });
  });
}

/* ---------- FOOTER ---------- */
function footer() {
  gsap.from('.foot__title span', { y: 80, opacity: 0, rotate: 3, stagger: 0.15, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.foot__title', start: 'top 85%' } });
  gsap.from('.foot__logo', { scale: 0.6, rotate: -12, opacity: 0, duration: 1.2, ease: 'elastic.out(1,.5)', scrollTrigger: { trigger: '.foot', start: 'top 70%' } });

  $$('[data-link]').forEach((a) => {
    const href = LINKS[a.dataset.link];
    if (href) { a.href = href; if (!href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; } }
    else a.addEventListener('click', (e) => { e.preventDefault(); toast('link coming soon.'); });
  });

  $('#toTop').addEventListener('click', () => scrollToEl(0, { duration: 3 }));
}

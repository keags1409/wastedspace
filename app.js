// Header glass, phone bar after the hero, and "Try the needle": trace a flash stencil until it's 85% inked.
const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// header turns to dark glass once you scroll
const top = $('#top');
const onScroll = () => top.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// phone bar only once the hero is scrolled past, so two WhatsApp buttons never stack
const bar = $('#bar');
new IntersectionObserver(([e]) => {
  const show = !e.isIntersecting && e.boundingClientRect.top < 0;
  bar.classList.toggle('show', show);
  bar.setAttribute('aria-hidden', String(!show));
  bar.querySelectorAll('a').forEach(a => a.tabIndex = show ? 0 : -1);
  document.body.classList.toggle('bar-on', show && innerWidth < 768);
}).observe($('#hero'));

// ---- Try the needle -------------------------------------------------------
// Dagger-through-heart flash with a banner, in a 300 x 340 design box. Drawn back to front.
const W = 300, H = 340, STEP = 4, REACH = 15, DONE_AT = 0.85;
const PARTS = [
  { d: 'M141 87 L141 230 L150 320 L159 230 L159 87', fill: '#c9d0d8' },                         // blade
  { d: 'M143 33 L157 33 L157 75 L143 75 Z', fill: '#2b1d14' },                                    // grip
  { d: 'M115 75 L185 75 Q191 81 185 87 L115 87 Q109 81 115 75 Z', fill: '#d6a63e' },              // guard
  { d: 'M159 24 A9 9 0 1 1 141 24 A9 9 0 1 1 159 24', fill: '#d6a63e' },                            // pommel
  { d: 'M150 250 C60 190 40 130 85 95 C115 72 145 90 150 118 C155 90 185 72 215 95 C260 130 240 190 150 250 Z', fill: '#b3261e' }, // heart
  { d: 'M58 152 L24 158 L40 173 L26 192 L58 186 Z', fill: '#e3cf9c' },                              // banner tail left
  { d: 'M242 152 L276 158 L260 173 L274 192 L242 186 Z', fill: '#e3cf9c' },                         // banner tail right
  { d: 'M58 146 Q150 128 242 146 L242 180 Q150 162 58 180 Z', fill: '#f3e4c0' },                   // banner
];
const LABEL = 'WASTED SPACE';

const skin = $('#skin'), canvas = $('#trace'), ctx = canvas.getContext('2d');
const pctEl = $('#pct'), status = $('#status'), done = $('#done');

// sample every part's outline so we can tell how much of it has been traced
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svg.setAttribute('aria-hidden', 'true');
svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
document.body.appendChild(svg);
for (const p of PARTS) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', p.d); svg.appendChild(el);
  const len = el.getTotalLength();
  p.path = new Path2D(p.d);
  p.pts = Array.from({ length: Math.floor(len / STEP) + 1 }, (_, i) => { const q = el.getPointAtLength(i * STEP); return { x: q.x, y: q.y, on: false }; });
}
svg.remove();
const ALL = PARTS.flatMap(p => p.pts);

let scale = 1, ox = 0, oy = 0, active = false, complete = false, fillT = 0, last = null, raf = 0;

function fit() {
  const r = skin.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  scale = Math.min(r.width / W, r.height / H) * 0.9;
  ox = (r.width - W * scale) / 2; oy = (r.height - H * scale) / 2;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  draw();
}
new ResizeObserver(fit).observe(skin);

function draw() {
  raf = 0;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const p of PARTS) {
    if (fillT > 0) { ctx.globalAlpha = fillT; ctx.fillStyle = p.fill; ctx.fill(p.path); ctx.globalAlpha = 1; }
    // purple transfer stencil underneath, fading out as the ink settles
    ctx.globalAlpha = 1 - fillT; ctx.strokeStyle = '#5b3fd1'; ctx.lineWidth = 1.3; ctx.stroke(p.path); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#141210'; ctx.lineWidth = 3.4;
    if (complete) { ctx.stroke(p.path); continue; }
    ctx.beginPath();
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i];
      if (a.on && b.on) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    }
    ctx.stroke();
  }
  ctx.fillStyle = complete ? '#141210' : 'rgba(91,63,209,.85)';
  ctx.font = '800 17px Archivo, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(LABEL, 150, 157);
}
const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };

// mark every sample within reach of the finger's path since the last move (fast swipes skip no line)
function ink(x, y) {
  const a = last || { x, y };
  const dx = x - a.x, dy = y - a.y, L2 = dx * dx + dy * dy || 1;
  for (const q of ALL) {
    if (q.on) continue;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L2));
    const ex = a.x + t * dx - q.x, ey = a.y + t * dy - q.y;
    if (ex * ex + ey * ey <= REACH * REACH) q.on = true;
  }
  last = { x, y };
  const pct = ALL.filter(q => q.on).length / ALL.length;
  pctEl.textContent = `${Math.round(pct * 100)}%`;
  if (pct >= DONE_AT) finish(); else redraw();
}

const toDesign = e => { const r = skin.getBoundingClientRect(); return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale }; };
canvas.addEventListener('pointerdown', e => {
  if (!active || complete) return;
  canvas.setPointerCapture(e.pointerId);
  last = null; const p = toDesign(e); ink(p.x, p.y);
});
canvas.addEventListener('pointermove', e => {
  if (!active || complete || !canvas.hasPointerCapture(e.pointerId)) return;
  for (const ev of e.getCoalescedEvents?.() || [e]) { const p = toDesign(ev); ink(p.x, p.y); }
});
const lift = () => { last = null; };
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);

function finish() {
  if (complete) return;
  complete = true; active = false;
  ALL.forEach(q => q.on = true);
  pctEl.textContent = '100%';
  skin.classList.remove('active'); skin.classList.add('complete');
  done.hidden = false;
  status.textContent = 'Stencil done. The finished dagger and heart is showing, with a button to book a tattoo.';
  navigator.vibrate?.(400);
  if (reduced) { fillT = 1; draw(); return; }
  const t0 = performance.now();
  const step = t => { fillT = Math.min(1, (t - t0) / 700); draw(); if (fillT < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

$('#start').addEventListener('click', () => { active = true; skin.classList.add('active'); status.textContent = 'Tracing on. Drag along the purple lines.'; });
$('#skip').addEventListener('click', finish);
$('#again').addEventListener('click', () => {
  ALL.forEach(q => q.on = false);
  complete = false; fillT = 0; active = true; last = null;
  skin.classList.remove('complete'); skin.classList.add('active');
  done.hidden = true; pctEl.textContent = '0%'; status.textContent = 'Cleared. Trace again.';
  draw();
});
document.querySelectorAll('.tone').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tone').forEach(t => t.setAttribute('aria-pressed', String(t === b)));
  skin.style.setProperty('--skin-a', b.dataset.a); skin.style.setProperty('--skin-b', b.dataset.b);
}));
document.fonts?.ready.then(draw);

// for the QA script: screen positions of every stencil sample, and progress
window.__trace = {
  get pct() { return ALL.filter(q => q.on).length / ALL.length; },
  get done() { return complete; },
  points() { const r = skin.getBoundingClientRect(); return ALL.map(q => ({ x: r.left + ox + q.x * scale, y: r.top + oy + q.y * scale })); },
};

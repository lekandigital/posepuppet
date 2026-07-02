/* replica.ts — assembles the reference.png clone: dresses panes with fx
   layers, generates feed/rail rows, and places the atmosphere. Pure page
   assembly; no imports from the app. */

import { dressPane } from './glass';

const $ = (sel: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};

/* ── dress the panes ─────────────────────────────────────────────── */

dressPane($('#p-nav'), {
  sparks: [{ x: 82, y: 6, o: 0.9 }, { x: 20, y: 12, o: 0.5 }],
});
dressPane($('#p-account'));
dressPane($('#p-main'), { frost: false, shine: false });
dressPane($('#p-composer'));
dressPane($('#p-feed'), { sparks: [{ x: 92, y: 3, o: 0.8 }] });
dressPane($('#p-rail'), { sparks: [{ x: 88, y: 5, o: 0.7 }] });
dressPane($('#p-media'), { shine: false });
dressPane($('#p-thumb'), { shine: false, frost: false });
dressPane($('#p-grasscard'), { frost: false });

/* ── feed rows ───────────────────────────────────────────────────── */

const ICONS = ['i-reply', 'i-retweet', 'i-heart', 'i-chart', 'i-share'];

interface FeedRow { avatar?: number; dots: number; actions?: number; divider?: number }
const FEED_ROWS: FeedRow[] = [
  { avatar: 18, dots: 34, actions: 109, divider: 133 },
  { avatar: 153, dots: 166, actions: 279, divider: 305 },
  { dots: 335, avatar: 422, actions: 492, divider: 517 },
  { dots: 548 }, // partial last row
];

const feed = $('#p-feed');
for (const row of FEED_ROWS) {
  if (row.avatar !== undefined) {
    const av = document.createElement('span');
    av.className = 'ag-avatar feed-avatar';
    av.style.top = `${row.avatar}px`;
    feed.appendChild(av);
  }
  const dots = document.createElement('span');
  dots.className = 'ag-icon feed-dots';
  dots.style.top = `${row.dots}px`;
  dots.innerHTML = '<svg><use href="#i-dots"/></svg>';
  feed.appendChild(dots);
  if (row.actions !== undefined) {
    const bar = document.createElement('div');
    bar.className = 'feed-actions';
    bar.style.top = `${row.actions}px`;
    bar.innerHTML = ICONS.map((i, n) => `<span class="ag-icon fa-${n + 1}"><svg><use href="#${i}"/></svg></span>`).join('');
    feed.appendChild(bar);
  }
  if (row.divider !== undefined) {
    const hr = document.createElement('span');
    hr.className = 'ag-divider';
    hr.style.cssText = `left:0;right:0;top:${row.divider}px`;
    feed.appendChild(hr);
  }
}

/* ── rail rows ───────────────────────────────────────────────────── */

const rail = $('#p-rail');
for (const y of [237, 341, 445, 550]) {
  const dots = document.createElement('span');
  dots.className = 'ag-icon rail-dots';
  dots.style.top = `${y}px`;
  dots.innerHTML = '<svg><use href="#i-dots"/></svg>';
  rail.appendChild(dots);
}
for (const y of [222, 312, 416, 520, 624]) {
  const hr = document.createElement('span');
  hr.className = 'ag-divider';
  hr.style.cssText = `left:22px;right:22px;top:${y}px;position:absolute`;
  rail.appendChild(hr);
}

/* ── atmosphere ──────────────────────────────────────────────────── */

const atmo = $('#atmosphere');

const flare = document.createElement('span');
flare.className = 'ag-flare';
flare.style.cssText = 'left:610px;top:-40px;width:1000px;height:260px';
atmo.appendChild(flare);
// thin horizontal lens streak through the flare core
const streak = document.createElement('span');
streak.style.cssText =
  'position:absolute;left:820px;top:6px;width:540px;height:3px;' +
  'background:linear-gradient(90deg,transparent,rgba(255,255,255,.9) 30%,rgba(255,255,255,.9) 70%,transparent);' +
  'filter:blur(1px);mix-blend-mode:screen';
atmo.appendChild(streak);

const STARS: Array<[number, number, number]> = [
  [1462, 28, 84],
  [1086, 6, 46],
];
for (const [x, y, s] of STARS) {
  const st = document.createElement('span');
  st.className = 'ag-star';
  st.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px`;
  atmo.appendChild(st);
}

/* grass glints along the bottom */
const GLINTS: Array<[number, number]> = [
  [392, 1002], [706, 992], [880, 975], [1052, 1012], [180, 1014], [1310, 998], [1185, 845],
];
for (const [x, y] of GLINTS) {
  const st = document.createElement('span');
  st.className = 'ag-star';
  st.style.cssText = `left:${x - 7}px;top:${y - 7}px;width:14px;height:14px;opacity:.8`;
  atmo.appendChild(st);
}

/* soap bubbles: [x, y, d] (centers, page coords) */
const BUBBLES: Array<[number, number, number]> = [
  [322, 602, 16], [276, 640, 30], [306, 250, 18],
  [140, 842, 26], [235, 865, 20], [52, 948, 34],
  [1428, 138, 13], [1446, 161, 12], [1514, 220, 26],
  [1510, 370, 36], [1497, 451, 10], [1510, 866, 33],
  [1535, 95, 140], // big orb clipped by the right edge
];
for (const [x, y, d] of BUBBLES) {
  const b = document.createElement('span');
  b.className = 'ag-bubble';
  b.style.cssText = `left:${x - d / 2}px;top:${y - d / 2}px;width:${d}px;height:${d}px`;
  atmo.appendChild(b);
}

/* ── reference overlay + stage scaling ───────────────────────────── */

const params = new URLSearchParams(location.search);
const ref = params.get('ref');
if (ref !== null) {
  const overlay = $('#ref-overlay') as HTMLImageElement;
  overlay.hidden = false;
  overlay.style.opacity = ref === '' ? '0.5' : ref;
}

const stage = $('#stage');
function fit(): void {
  if (params.get('noscale') !== null) return;
  const s = Math.min(window.innerWidth / 1535, window.innerHeight / 1024);
  stage.style.transform = `scale(${Math.min(s, 1)})`;
}
window.addEventListener('resize', fit);
fit();

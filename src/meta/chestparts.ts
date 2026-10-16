// Sandık parçacık motoru: tam ekran canvas, isteğe bağlı başlar, boşalınca
// kendini bitirir (kalıcı rAF yok). inward (içe çekilme) + wave1 (konfeti) +
// wave2 (yıldız/kıvılcım/köz). Tier yoğunluğu coin < nadir < epik.
// fxCalm'de hiçbir şey üretmez; düşük kalitede yarı yoğunluk + DPR 1.
import { fxCalm, qMode } from '../utils/settings.ts';

export type ChestTier = 'coin' | 'nadir' | 'epik';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[(Math.random() * a.length) | 0];

interface P {
  t: 'in' | 'conf' | 'star' | 'spark' | 'dot';
  x: number; y: number; x0: number; y0: number; tx: number; ty: number;
  vx: number; vy: number; gr: number; dr: number;
  a: number; dl: number; l: number; s: number; c: string;
  rot: number; vr: number; fl: number; ph: number;
}

const PAL: Record<ChestTier, string[]> = {
  coin: ['#ffd35c', '#ffe58a', '#fff3b0', '#ffb02e', '#ffffff'],
  nadir: ['#4ee063', '#a8ff3e', '#d9ffd0', '#2be7ff', '#ffffff', '#ffd35c'],
  epik: ['#b46bff', '#9d5cff', '#e3c8ff', '#ff5cf0', '#2be7ff', '#ffffff'],
};
const NUM: Record<ChestTier, [number, number]> = {
  coin: [64, 44],
  nadir: [104, 64],
  epik: [160, 96],
};

const parts: P[] = [];
let raf = 0;
let last = 0;
let cx: CanvasRenderingContext2D | null = null;
let W = 0;
let H = 0;

const low = (): boolean => qMode() === 'low';
/** Düşük kalitede yarı yoğunluk. */
const qf = (): number => (low() ? 0.45 : 1);
const sc = (): number => Math.min(1, Math.max(0.62, W / 900));

function fit(c: HTMLCanvasElement): void {
  cx = c.getContext('2d');
  const dpr = low() ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  cx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function kick(): void {
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

function star(r: number): void {
  if (!cx) return;
  cx.beginPath();
  cx.moveTo(0, -r);
  cx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
  cx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
  cx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
  cx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
  cx.fill();
}

function frame(now: number): void {
  raf = 0;
  if (!cx) return;
  const dt = Math.min(0.034, (now - last) / 1000);
  last = now;
  cx.clearRect(0, 0, W, H);
  const add = !low();
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.dl > 0) {
      p.dl -= dt;
      continue;
    }
    p.a += dt;
    if (p.a >= p.l) {
      parts[i] = parts[parts.length - 1];
      parts.pop();
      continue;
    }
    const k = p.a / p.l;
    const al = k > 0.62 ? (1 - k) / 0.38 : 1;
    cx.fillStyle = p.c;
    cx.strokeStyle = p.c;
    if (p.t === 'in') {
      const e = k * k;
      const e0 = Math.max(0, k - 0.12) ** 2;
      const x = p.x0 + (p.tx - p.x0) * e;
      const y = p.y0 + (p.ty - p.y0) * e;
      const xo = p.x0 + (p.tx - p.x0) * e0;
      const yo = p.y0 + (p.ty - p.y0) * e0;
      cx.globalAlpha = Math.min(1, k * 3) * (1 - k * 0.25);
      cx.globalCompositeOperation = add ? 'lighter' : 'source-over';
      cx.lineWidth = p.s;
      cx.lineCap = 'round';
      cx.beginPath();
      cx.moveTo(xo, yo);
      cx.lineTo(x, y);
      cx.stroke();
      continue;
    }
    p.vx -= p.vx * p.dr * dt;
    p.vy += p.gr * dt - ((p.vy * p.dr * dt) * 0.5);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    cx.globalAlpha = Math.max(0, al);
    if (p.t === 'conf') {
      p.rot += p.vr * dt;
      const fl = Math.cos(p.a * p.fl + p.ph);
      cx.globalCompositeOperation = 'source-over';
      cx.save();
      cx.translate(p.x, p.y);
      cx.rotate(p.rot);
      cx.fillRect(-p.s, -p.s * 0.55 * fl, p.s * 2, p.s * 1.1 * Math.abs(fl) + 0.6);
      cx.restore();
    } else if (p.t === 'star') {
      cx.globalCompositeOperation = add ? 'lighter' : 'source-over';
      const r = p.s * (1 + 0.3 * Math.sin(p.a * 14 + p.ph)) * (1 - k * 0.35);
      cx.save();
      cx.translate(p.x, p.y);
      cx.rotate(p.rot + p.a * 2);
      star(r);
      cx.restore();
    } else if (p.t === 'spark') {
      cx.globalCompositeOperation = add ? 'lighter' : 'source-over';
      cx.lineWidth = p.s;
      cx.lineCap = 'round';
      cx.beginPath();
      cx.moveTo(p.x, p.y);
      cx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      cx.stroke();
    } else {
      cx.globalCompositeOperation = add ? 'lighter' : 'source-over';
      cx.beginPath();
      cx.arc(p.x, p.y, Math.max(0.4, p.s * (1 - k * 0.55)), 0, TAU);
      cx.fill();
    }
  }
  cx.globalAlpha = 1;
  cx.globalCompositeOperation = 'source-over';
  if (parts.length) raf = requestAnimationFrame(frame);
  else cx.clearRect(0, 0, W, H);
}

/** Motoru durdur + canvası temizle (kapanışta çağrılır). */
export function stopChestParts(): void {
  parts.length = 0;
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  cx?.clearRect(0, 0, W, H);
}

/** Gerilimde sandığa çekilen kıvılcımlar. */
export function chestInward(c: HTMLCanvasElement, x: number, y: number): void {
  if (fxCalm()) return;
  fit(c);
  const n = Math.round(60 * qf());
  const k = Math.min(1, W / 700 + 0.35);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU);
    const r = rnd(90, 230) * k;
    parts.push({
      t: 'in', x0: x + Math.cos(a) * r, y0: y + Math.sin(a) * r * 0.8, tx: x, ty: y,
      x: 0, y: 0, vx: 0, vy: 0, gr: 0, dr: 0, a: 0, dl: rnd(0, 0.38), l: rnd(0.26, 0.4),
      s: rnd(1.6, 3.2), c: pick(PAL.coin), rot: 0, vr: 0, fl: 0, ph: 0,
    });
  }
  kick();
}

/** Patlama 1. dalga: konfeti. */
export function chestWave1(c: HTMLCanvasElement, x: number, y: number, tier: ChestTier): void {
  if (fxCalm()) return;
  fit(c);
  const n = Math.round(NUM[tier][0] * qf());
  const k = sc();
  const pal = PAL[tier];
  for (let i = 0; i < n; i++) {
    const a = Math.random() < 0.2 ? rnd(0, TAU) : rnd(-2.95, -0.2);
    const sp = rnd(260, 720) * k;
    parts.push({
      t: Math.random() < 0.78 ? 'conf' : 'dot', x, y, x0: 0, y0: 0, tx: 0, ty: 0,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gr: 820 * k + 200, dr: 0.9,
      a: 0, dl: 0, l: rnd(1.5, 2.5), s: rnd(3, 6.2) * (k > 0.8 ? 1 : 0.85),
      c: pick(pal), rot: rnd(0, TAU), vr: rnd(-12, 12), fl: rnd(6, 14), ph: rnd(0, TAU),
    });
  }
  kick();
}

/** Patlama 2. dalga: yıldız + kıvılcım (+ nadir/epikte yükselen köz). */
export function chestWave2(c: HTMLCanvasElement, x: number, y: number, tier: ChestTier): void {
  if (fxCalm()) return;
  fit(c);
  const n = Math.round(NUM[tier][1] * qf());
  const k = sc();
  const pal = PAL[tier];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU);
    const sp = rnd(320, 900) * k;
    const isStar = i % 3 === 0;
    parts.push({
      t: isStar ? 'star' : 'spark', x, y, x0: 0, y0: 0, tx: 0, ty: 0,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, gr: 190, dr: 1.7,
      a: 0, dl: 0, l: rnd(0.8, 1.5),
      s: isStar ? rnd(5, tier === 'epik' ? 12 : 9) : rnd(1.6, 3.2),
      c: pick(pal), rot: rnd(0, TAU), vr: 0, fl: 0, ph: rnd(0, TAU),
    });
  }
  if (tier !== 'coin') {
    const m = Math.round(26 * qf());
    for (let i = 0; i < m; i++) {
      parts.push({
        t: 'dot', x: x + rnd(-60, 60), y: y + rnd(-10, 10), x0: 0, y0: 0, tx: 0, ty: 0,
        vx: rnd(-40, 40), vy: rnd(-150, -50), gr: -30, dr: 0.6,
        a: 0, dl: rnd(0, 0.25), l: rnd(1.3, 2.3), s: rnd(1.6, 3), c: pick(pal),
        rot: 0, vr: 0, fl: 0, ph: 0,
      });
    }
  }
  kick();
}

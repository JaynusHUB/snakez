// Market canlı önizleme motoru: tek rAF döngüsü, bağımsız (oyun motoruna dokunmaz).
// Efekt parametreleri oyundaki FxCfg ile aynı anlama gelir; önizleme oyundakine yakındır, birebir değildir.
import type { FxCfg } from '../systems/SkinFx.ts';
import { buildBody, createSnake } from '../entities/Snake.ts';
import type { Snake } from '../entities/Snake.ts';
import { drawSnakeBody } from '../systems/RenderSystem.ts';
import { fxCalm } from '../utils/settings.ts';

interface Tick { step(dt: number, t: number): void }
const live = new Set<Tick>();
let raf = 0, last = 0;
function loop(ms: number): void {
  const dt = Math.min(0.05, (ms - last) / 1000); last = ms;
  if (!document.hidden) live.forEach((s) => s.step(dt, ms / 1000));
  raf = live.size ? requestAnimationFrame(loop) : 0;
}
function add(s: Tick): void { live.add(s); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

const calm = (): boolean => fxCalm();
const TAU = Math.PI * 2;
const rnd = (r: [number, number]): number => r[0] + Math.random() * (r[1] - r[0]);

const cache = new Map<string, HTMLCanvasElement>();
function sprite(kind: 'd' | 'k', c: string): HTMLCanvasElement {
  const key = kind + c, hit = cache.get(key);
  if (hit) return hit;
  const S = 48, m = S / 2, e = document.createElement('canvas');
  e.width = S; e.height = S;
  const x = e.getContext('2d')!;
  if (kind === 'd') {
    const g = x.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.25, c); g.addColorStop(0.6, c + '55'); g.addColorStop(1, c + '00');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  } else {
    const g = x.createRadialGradient(m, m, 0, m, m, m * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, c + '00');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.fillStyle = c;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      x.beginPath(); x.moveTo(m + dx * (m - 1), m + dy * (m - 1)); x.lineTo(m - dy * 2.6, m + dx * 2.6);
      x.lineTo(m - dx * (m - 1), m - dy * (m - 1)); x.lineTo(m + dy * 2.6, m - dx * 2.6); x.closePath(); x.fill();
    }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(m, m, 3, 0, TAU); x.fill();
  }
  cache.set(key, e);
  return e;
}

interface P { x: number; y: number; vx: number; vy: number; age: number; life: number; sz: number; ph: number; spark: boolean; c: string }
/** skin verilirse yılan oyunun kendi çizicisiyle (menüdeki gibi baş+gövde+kuyruk) çizilir. */
interface StageOpts { cfg: FxCfg | null; colors: string[]; img?: string; r: number; skin?: number }

/** Sinüs yolunda süzülen bir yılan + takılı efektin parçacıkları. */
export class FxStage implements Tick {
  boost = false;
  private cx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private o: StageOpts;
  private w = 0; private h = 0; private dpr = 1; private t = 0;
  private parts: P[] = []; private acc = 0; private prev: [number, number] | null = null;
  private img: HTMLImageElement | null = null; private imgSrc = '';
  private sn: Snake | null = null;

  constructor(canvas: HTMLCanvasElement, o: StageOpts) {
    this.canvas = canvas; this.cx = canvas.getContext('2d')!; this.o = o;
    this.set(o);
    add(this);
  }

  set(o: StageOpts): void {
    this.o = o;
    if (o.img !== this.imgSrc) {
      this.imgSrc = o.img ?? ''; this.img = null;
      if (o.img) { const i = new Image(); i.onload = () => { this.img = i; }; i.src = o.img; }
    }
  }
  dispose(): void { live.delete(this); }

  private fit(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight, d = Math.min(1.75, devicePixelRatio || 1);
    if (w !== this.w || h !== this.h || d !== this.dpr) {
      this.w = w; this.h = h; this.dpr = d; this.canvas.width = Math.max(1, w * d); this.canvas.height = Math.max(1, h * d);
    }
  }
  private pos(t: number): [number, number] {
    return [this.w * (0.5 + 0.27 * Math.sin(t * 0.85)), this.h * (0.5 + 0.17 * Math.sin(t * 1.7 + 1))];
  }

  step(dt: number, now: number): void {
    this.fit();
    if (!this.w || !this.h) return;
    const sk = this.o.skin !== undefined, sp = this.boost ? 2.1 : 1, N = sk ? 30 : 22, gap = (sk ? 0.1 : 0.075) / sp;
    this.t += dt * sp * 0.7;
    const t = this.t, cfg = this.o.cfg, r = this.o.r, [hx, hy] = this.pos(t);
    const [ox, oy] = this.pos(t - 0.02), ang = Math.atan2(hy - oy, hx - ox);
    if (cfg && this.prev && dt > 0) {
      this.acc += Math.hypot(hx - this.prev[0], hy - this.prev[1]) * cfg.rate * (this.boost ? cfg.boostMul : 1) * 1.5;
      while (this.acc >= 1 && this.parts.length < 110) {
        this.acc -= 1;
        const tail = Math.random() < cfg.tailShare, i = tail ? N : Math.floor(N * Math.pow(Math.random(), cfg.bodyBias));
        const [px, py] = this.pos(t - i * gap), cols = tail && cfg.tailColors ? cfg.tailColors : cfg.colors;
        this.parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 2 * cfg.spread * r, vy: (Math.random() - 0.5) * cfg.spread * r - cfg.rise * r,
          age: 0, life: rnd(cfg.life), sz: r * rnd(cfg.size) * 1.3, ph: Math.random() * 6, spark: Math.random() < cfg.sparkChance, c: cols[Math.floor(Math.random() * cols.length)] });
      }
    }
    this.prev = [hx, hy];
    for (const p of this.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter((p) => p.age < p.life);
    this.draw(t, now, N, gap, ang, r);
  }

  /** Oyuncunun gerçek skinini sinüs yolunda çizer (menüdeki vitrinle aynı çizim kodu). */
  private drawSkin(t: number, N: number, gap: number, ang: number, r: number): void {
    const skin = this.o.skin!, s = this.sn ?? (this.sn = createSnake('fx', skin, false, 0, 0, 0, 0));
    s.skin = skin; s.r = r * 1.1; s.fx = 0.6;
    const tx = s.tx, ty = s.ty, M = N * 3;
    tx.length = 0; ty.length = 0;
    let len = 0, px = 0, py = 0;
    for (let k = M; k >= 0; k--) {
      const [x, y] = this.pos(t - (k * gap) / 3);
      if (k < M) len += Math.hypot(x - px, y - py);
      tx.push(x); ty.push(y); px = x; py = y;
    }
    const [hx, hy] = this.pos(t);
    s.ts = 0; s.dlen = Math.max(8, len - 1); s.x = hx; s.y = hy; s.ang = ang; s.wang = ang;
    buildBody(s);
    drawSnakeBody(this.cx, s, 1, -1e5, 1e5, -1e5, 1e5);
  }

  private draw(t: number, now: number, N: number, gap: number, ang: number, r: number): void {
    const cx = this.cx, cols = this.o.colors, cfg = this.o.cfg;
    cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    cx.clearRect(0, 0, this.w, this.h);
    const skin = this.o.skin !== undefined;
    if (skin) this.drawSkin(t, N, gap, ang, r);
    for (let i = skin ? -1 : N; i >= 0; i--) {
      const [x, y] = this.pos(t - i * gap), u = r * (1 - (i / N) * 0.5), c = cols[Math.floor(i / 2) % cols.length];
      cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.18; cx.drawImage(sprite('d', c), x - u * 2.2, y - u * 2.2, u * 4.4, u * 4.4);
      cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1; cx.fillStyle = c;
      cx.beginPath(); cx.arc(x, y, u, 0, TAU); cx.fill();
      cx.fillStyle = 'rgba(255,255,255,.22)'; cx.beginPath(); cx.arc(x - u * 0.25, y - u * 0.3, u * 0.5, 0, TAU); cx.fill();
    }
    cx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const k = p.age / p.life, tw = cfg?.twinkle ? 0.6 + 0.4 * Math.sin(p.age * 14 + p.ph) : 1;
      cx.globalAlpha = Math.min(1, (1 - k) * 1.7) * tw;
      const s = p.sz * (cfg?.shrink ? 1 - k * 0.8 : 1) * (p.spark ? 3 : 4);
      cx.drawImage(sprite(p.spark ? 'k' : 'd', p.c), p.x - s / 2, p.y - s / 2, s, s);
    }
    cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
    const [hx, hy] = this.pos(t), g = cfg?.headGlow;
    if (g) {
      const gs = r * g.size * 2.2 * (1 + g.pulse * Math.sin(now * 5));
      cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = Math.min(1, g.alpha * 2.2);
      cx.drawImage(sprite('d', g.color), hx + Math.cos(ang) * r * g.forward - gs, hy + Math.sin(ang) * r * g.forward - gs, gs * 2, gs * 2);
      cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
    }
    if (skin) return;
    if (this.img) {
      const hh = r * 3.4, ww = hh * (this.img.naturalWidth / this.img.naturalHeight);
      cx.save(); cx.translate(hx, hy); cx.rotate(ang); cx.drawImage(this.img, -ww * 0.6, -hh / 2, ww, hh); cx.restore();
    } else {
      cx.fillStyle = cols[0]; cx.beginPath(); cx.arc(hx, hy, r * 1.08, 0, TAU); cx.fill();
      cx.fillStyle = '#fff';
      for (const s of [-1, 1]) { cx.beginPath(); cx.arc(hx + Math.cos(ang) * r * 0.35 - Math.sin(ang) * r * 0.42 * s, hy + Math.sin(ang) * r * 0.35 + Math.cos(ang) * r * 0.42 * s, r * 0.24, 0, TAU); cx.fill(); }
    }
  }
}

/** Market arka planında süzülen ışık tozu. */
export class Ambient implements Tick {
  private cx: CanvasRenderingContext2D;
  private c: HTMLCanvasElement;
  private d: Array<{ x: number; y: number; r: number; s: number; c: string; p: number }> = [];
  constructor(canvas: HTMLCanvasElement) {
    this.c = canvas; this.cx = canvas.getContext('2d')!;
    const pal = ['#9d5cff', '#2be7ff', '#ff5cf0', '#ffd35c'];
    for (let i = 0; i < 36; i++) this.d.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.4, s: 0.01 + Math.random() * 0.03, c: pal[i % 4], p: Math.random() * 6 });
    add(this);
  }
  dispose(): void { live.delete(this); }
  step(dt: number, now: number): void {
    const w = this.c.clientWidth, h = this.c.clientHeight;
    if (!w || !h) return;
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
    const cx = this.cx; cx.clearRect(0, 0, w, h); cx.globalCompositeOperation = 'lighter';
    for (const p of this.d) {
      p.y -= p.s * dt; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      cx.globalAlpha = 0.25 + 0.25 * Math.sin(now * 1.5 + p.p);
      const s = p.r * 7; cx.drawImage(sprite('d', p.c), p.x * w - s / 2, p.y * h - s / 2, s, s);
    }
    cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  }
}

/** Satın alma / sandık patlaması (konfeti + ışık). opts geriye uyumlu:
 *  n = parçacık sayısı (varsayılan 90), size = boyut çarpanı (varsayılan 1). */
export function burst(canvas: HTMLCanvasElement, color: string, opts?: { n?: number; size?: number }): void {
  if (calm()) return;
  const N = opts?.n ?? 90, SZ = opts?.size ?? 1;
  const w = (canvas.width = canvas.clientWidth), h = (canvas.height = canvas.clientHeight), cx = canvas.getContext('2d')!;
  const cols = [color, '#ffffff', '#ffd35c', '#2be7ff', '#ff5cf0'];
  const ps = Array.from({ length: N }, () => {
    const a = Math.random() * TAU, v = 140 + Math.random() * 380;
    return { x: w / 2 + (Math.random() - 0.5) * 56, y: h * 0.42 + (Math.random() - 0.5) * 34, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, r: (2 + Math.random() * 3.5) * SZ, c: cols[Math.floor(Math.random() * cols.length)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 };
  });
  let t0 = 0;
  const f = (ms: number): void => {
    if (!t0) t0 = ms;
    const k = (ms - t0) / 1300;
    cx.clearRect(0, 0, w, h);
    if (k >= 1) return;
    for (const p of ps) {
      const dt = 0.016; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.rot += p.vr * dt;
      cx.globalAlpha = 1 - k; cx.fillStyle = p.c; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); cx.restore();
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

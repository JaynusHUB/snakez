// Sprite skinler için hareket efektleri (parçacıklar + baş parlaması).
// Her yılanın kendi küçük parçacık havuzu vardır (WeakMap: yılan ölünce kendiliğinden
// temizlenir). Parçacıklar yılanın katettiği MESAFEYE göre doğar; yani yılan ne kadar
// hızlı giderse o kadar çok efekt çıkar, boost'ta daha da artar.
//
// Maliyet: yalnızca ekranda görünen yılanlar güncellenir/çizilir, yılan başına
// parçacık tavanı kaliteye göre (düşük 20); hepsi önceden çizilmiş küçük
// sprite (gradient her karede kurulmaz).
import type { Snake } from '../entities/Snake.ts';
import { TAU, rgba } from '../utils/MathUtils.ts';
import { qGlow, qMax, qRate } from '../utils/settings.ts';

export interface HeadGlow {
  color: string;
  /** Başın ne kadar önünde (yarıçap çarpanı). */
  forward: number;
  /** Parlama yarıçapı (yarıçap çarpanı). */
  size: number;
  /** Nabız genliği (0..1). */
  pulse: number;
  alpha: number;
}

export interface FxCfg {
  colors: string[];
  /** Kuyruk ucundan çıkanlar için ayrı renkler (yoksa colors). */
  tailColors?: string[];
  /** Parçacığın 4 köşeli yıldız olma ihtimali (kalanı yumuşak nokta). */
  sparkChance: number;
  /** Katedilen birim mesafe başına parçacık sayısı. */
  rate: number;
  /** Boost sırasında rate çarpanı. */
  boostMul: number;
  life: [number, number];
  /** Parçacık yarıçapı = yılan yarıçapı × bu aralık. */
  size: [number, number];
  /** Yukarı süzülme hızı (yarıçap/sn). Negatif = aşağı düşer (kar). */
  rise: number;
  /** Rastgele yatay/dikey saçılma hızı (yarıçap/sn). */
  spread: number;
  /** 1 = gövdeye eşit dağıl; büyüdükçe başa yaklaşır. */
  bodyBias: number;
  /** Parçacıkların kuyruk ucundan doğma ihtimali (0..1). */
  tailShare: number;
  /** Yıldız gibi parıldasın mı. */
  twinkle: boolean;
  /** Ömrü boyunca küçülsün mü (kıvılcım/köz). */
  shrink: boolean;
  headGlow?: HeadGlow;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  sz: number;
  ph: number;
  spr: HTMLCanvasElement;
}

interface FxState {
  t: number;
  lx: number;
  ly: number;
  acc: number;
  parts: Particle[];
}

const STATES = new WeakMap<Snake, FxState>();
// Tavan kaliteye göre settings.qMax()'ten gelir (düşükte 20).

// ── Önceden çizilmiş sprite'lar ──────────────────────────────────────────
const CACHE = new Map<string, HTMLCanvasElement>();

function mk(size: number): HTMLCanvasElement {
  const e = document.createElement('canvas');
  e.width = size;
  e.height = size;
  return e;
}

function dotSprite(c: string): HTMLCanvasElement {
  const k = 'd' + c;
  const hit = CACHE.get(k);
  if (hit) return hit;
  const S = 32;
  const m = S / 2;
  const e = mk(S);
  const x = e.getContext('2d')!;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.22, rgba(c, 0.9));
  g.addColorStop(0.55, rgba(c, 0.28));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  CACHE.set(k, e);
  return e;
}

function sparkSprite(c: string): HTMLCanvasElement {
  const k = 'k' + c;
  const hit = CACHE.get(k);
  if (hit) return hit;
  const S = 48;
  const m = S / 2;
  const e = mk(S);
  const x = e.getContext('2d')!;
  const g = x.createRadialGradient(m, m, 0, m, m, m * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  x.fillStyle = c;
  const arm = (dx: number, dy: number): void => {
    x.beginPath();
    x.moveTo(m + dx * (m - 1), m + dy * (m - 1));
    x.lineTo(m - dy * 2.6, m + dx * 2.6);
    x.lineTo(m - dx * (m - 1), m - dy * (m - 1));
    x.lineTo(m + dy * 2.6, m - dx * 2.6);
    x.closePath();
    x.fill();
  };
  arm(1, 0);
  arm(0, 1);
  x.fillStyle = '#fff';
  x.beginPath();
  x.arc(m, m, 3, 0, TAU);
  x.fill();
  CACHE.set(k, e);
  return e;
}

const rnd2 = (r: [number, number]): number => r[0] + Math.random() * (r[1] - r[0]);

/**
 * Yılanın efektini günceller ve çizer. `drawSpriteSnake` sonunda çağrılır.
 * İlk çağrıda (örn. menüdeki tek seferlik küçük önizleme) hiçbir şey doğmaz.
 */
export function runSkinFx(
  cx: CanvasRenderingContext2D,
  s: Snake,
  cfg: FxCfg,
  vx0: number,
  vx1: number,
  vy0: number,
  vy1: number,
): void {
  const now = performance.now();
  let st = STATES.get(s);
  if (!st) {
    st = { t: now, lx: s.x, ly: s.y, acc: 0, parts: [] };
    STATES.set(s, st);
  }
  let dt = (now - st.t) / 1000;
  st.t = now;
  if (!(dt > 0)) dt = 0;
  else if (dt > 0.1) dt = 0.1;
  // Işınlanma/yeniden doğma anında dev mesafe parçacık sağanağı yapmasın.
  const dist = Math.min(30, Math.hypot(s.x - st.lx, s.y - st.ly));
  st.lx = s.x;
  st.ly = s.y;

  const bn = s.bn;
  const b = s.body;
  const pad = s.r * 5;
  const vis = (x: number, y: number): boolean =>
    x > vx0 - pad && x < vx1 + pad && y > vy0 - pad && y < vy1 + pad;

  // Ekranda değilse: parçacıkları at, hiçbir iş yapma.
  let seen = vis(s.x, s.y);
  if (!seen && bn > 1) {
    seen = vis(b[(bn - 1) * 2], b[(bn - 1) * 2 + 1]) || vis(b[(bn >> 1) * 2], b[(bn >> 1) * 2 + 1]);
  }
  if (!seen) {
    st.parts.length = 0;
    return;
  }

  // ── Doğur ──
  const parts = st.parts;
  st.acc += dist * cfg.rate * qRate() * Math.sqrt(s.r / 10) * (s.boosting ? cfg.boostMul : 1);
  let n = Math.floor(st.acc);
  st.acc -= n;
  if (n > 4) n = 4;
  const cap = qMax();
  for (let q = 0; q < n && parts.length < cap; q++) {
    const fromTail = bn > 1 && Math.random() < cfg.tailShare;
    let bx = s.x;
    let by = s.y;
    if (bn > 0) {
      const i = fromTail ? bn - 1 : Math.min(bn - 1, Math.floor(Math.pow(Math.random(), cfg.bodyBias) * bn));
      bx = b[i * 2];
      by = b[i * 2 + 1];
    }
    const a = Math.random() * TAU;
    const rad = s.r * (fromTail ? 0.15 + Math.random() * 0.6 : 0.7 + Math.random() * 1.2);
    const cols = fromTail && cfg.tailColors ? cfg.tailColors : cfg.colors;
    const col = cols[(Math.random() * cols.length) | 0];
    parts.push({
      x: bx + Math.cos(a) * rad,
      y: by + Math.sin(a) * rad,
      vx: (Math.random() * 2 - 1) * cfg.spread * s.r,
      vy: -cfg.rise * s.r * (fromTail ? 1.4 : 1) + (Math.random() * 2 - 1) * cfg.spread * s.r,
      age: 0,
      life: rnd2(cfg.life),
      sz: s.r * rnd2(cfg.size),
      ph: Math.random() * TAU,
      spr: Math.random() < cfg.sparkChance ? sparkSprite(col) : dotSprite(col),
    });
  }

  // ── Güncelle + çiz ──
  cx.globalCompositeOperation = 'lighter';
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) {
      parts[i] = parts[parts.length - 1];
      parts.pop();
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const t = p.age / p.life;
    let al = t < 0.15 ? t / 0.15 : (1 - t) / 0.85;
    if (cfg.twinkle) al *= 0.65 + 0.35 * Math.sin(p.age * 16 + p.ph);
    const sz = p.sz * (cfg.shrink ? 1 - 0.55 * t : 0.7 + 0.3 * Math.sin(Math.PI * t));
    cx.globalAlpha = al * 0.9;
    cx.drawImage(p.spr, p.x - sz, p.y - sz, sz * 2, sz * 2);
  }

  // ── Baş parlaması (gözler / yüz) ──
  // Kalite düşükse atlanır (qGlow 0).
  const g = cfg.headGlow;
  if (g && qGlow() > 0) {
    const pulse = 1 + g.pulse * Math.sin((now / 1000) * 6 + s.id);
    const gs = s.r * g.size * pulse;
    const hx = s.x + Math.cos(s.ang) * s.r * g.forward;
    const hy = s.y + Math.sin(s.ang) * s.r * g.forward;
    cx.globalAlpha = Math.min(1, g.alpha * (1 + 0.7 * s.fx) * qGlow());
    cx.drawImage(dotSprite(g.color), hx - gs, hy - gs, gs * 2, gs * 2);
  }
  cx.globalAlpha = 1;
  cx.globalCompositeOperation = 'source-over';
}

// ── Market efekti: yılana takılan efekt, skin'in kendi efektinin yerine geçer ──
const SNAKE_FX = new WeakMap<Snake, FxCfg>();
export function setSnakeFx(s: Snake, cfg: FxCfg | null): void {
  if (cfg) SNAKE_FX.set(s, cfg);
  else SNAKE_FX.delete(s);
}
export function getSnakeFx(s: Snake): FxCfg | undefined {
  return SNAKE_FX.get(s);
}

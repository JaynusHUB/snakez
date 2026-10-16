// Ölüm yemi efektleri: 8 premium skine BAĞLI, takılı skinden türetilen tema.
// Ayrı ürün/fiyat/sekme YOK; premium skin takılıysa otomatik uygulanır.
// Kayıt yapısına alan eklenmez (efekt skin id'den çözülür), bulut/yedek
// mantığına dokunulmaz. Kütle/boyut/toplanma/sayı/çarpışma AYNI kalır,
// yalnızca görünüm değişir: hazır WebP sprite (public/death-food) +
// kodla çizilen kontrollü parıltı/kıvılcım. Yeni runtime paketi YOK.
import { TAU, rgba } from '../utils/MathUtils.ts';
import { fxCalm, qGlow } from '../utils/settings.ts';
import { deathSprite, ensureDeathSprite, spriteMip } from './DeathSprites.ts';

export const DEATH_FX_NONE = 0;
export const DEATH_FX_BLUE = 8;

/** Sprite id sırası = tema id sırası (1..8). catalog SHOP_SKINS ile aynı dizilim. */
const SPRITE_IDS = ['krampus', 'werewolf', 'redwolf', 'cygnus', 'xen', 'pinkdragon', 'greendragon', 'bluedragon'];

/** Tema id -> glow rengi (sprite arkası kontrollü parıltı + kıvılcım). */
const THEME_GLOW: Record<number, string> = {
  1: '#bfe9ff',
  2: '#ff7a1a',
  3: '#ff5a6e',
  4: '#b46bff',
  5: '#2be7ff',
  6: '#ff4da6',
  7: '#4dff6a',
  8: '#4dc9ff',
};

/** Takılı skinin ölüm yemi teması (0 = efekt yok, normal yem). */
export function deathFxFor(spriteId: string | undefined): number {
  if (!spriteId) return DEATH_FX_NONE;
  const i = SPRITE_IDS.indexOf(spriteId);
  return i < 0 ? DEATH_FX_NONE : i + 1;
}

export function hasDeathFx(spriteId: string | undefined): boolean {
  return deathFxFor(spriteId) !== DEATH_FX_NONE;
}

/** drawDeathFx'in ihtiyaç duyduğu en küçük yem şekli (Pellet uyar). */
export interface BluePellet {
  x: number;
  y: number;
  /** Ölüm merkezi: saçılma buradan başlar, (x, y)'de biter. */
  ox: number;
  oy: number;
  ph: number;
  born: number;
  fx: number;
}

export interface Shock {
  x: number;
  y: number;
  t0: number;
}

export interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  life: number;
  sd: number;
  fx: number;
}

/* ── Doğuş animasyonu sabitleri (yalnızca görsel; hepsi burada) ───────────
 * Dalga: born sırası verir (DeathSystem j*0.004, vücut sırası) — oraya
 * dokunulmaz; aşağıdaki sayılar ÇİZİM animasyonunu ayarlar. Mantıksal
 * konum (x, y) ilk andan finaldir; aşağıdakiler yalnız çizim ofsetidir. */
const SETTLE_DUR = 0.75;   // süzülme+ölçek+opaklık yerleşme süresi (0.6-0.9 sn)
const DRIFT_MIN = 15;      // süzülme mesafesi alt sınır (dünya px)
const DRIFT_MAX = 50;      // süzülme mesafesi üst sınır (dünya px)
const SPAWN_SCALE0 = 0.2;  // doğuş başlangıç ölçeği
const BACK_C = 1.5;        // easeOutBack katsayısı (~1.07 aşma tepesi)
const FADE_IN = 0.3;       // opaklığın 0->1 çıktığı süre (sn)
const TWIST = 1.2;         // yerleşme son açı fark aralığı (radyan)
const GLOW_R = 1.35;       // parıltı yarıçapı (sprite yarısının katı)
const GLOW_BASE = 0.16;    // yerleşmiş parıltı yoğunluğu (düşük: leke yapmaz)
const GLOW_BOOST = 0.22;   // ölüm anı ek parıltı (ilk pencerede)
const GLOW_WINDOW = 0.3;   // boost penceresi (sn)
const GLOW_CALM = 0.14;    // sakin mod sabit parıltı (nabız yok)
const PULSE_AMP = 0.05;    // nabız genliği (çok düşük)
const PULSE_HZ = 2.4;      // nabız hızı (rad/sn)
const TRAIL_N = 2;         // uçuş kuyruk hayaleti (bütçeli)
/** Şok halkası süresi. */
const SHOCK_DUR = 0.55;
/** Sprite uzun kenarı = mantıksal yem yarıçapının bu katı (görsel only).
 * Normal yem görseli q≈r*5.6; K=6 -> ~1.1x q: okunaklı, ekranı doldurmaz. */
export const SPRITE_K = 6;
/** Ekranda aynı anda çizilen sprite'lı yem tavanı (fazlası nokta). */
export const SPRITE_CAP = 120;

function mkc(): HTMLCanvasElement {
  const e = document.createElement('canvas');
  e.width = 64;
  e.height = 64;
  return e;
}

function frac(v: number): number {
  return v - Math.floor(v);
}

/** Yerdeki sabit duruş açısı (yem başına, dönmez). Sprite sağa bakar. */
export function groundAngle(ph: number): number {
  return frac(ph * 0.6180339887) * TAU;
}

/** Boyut kademesi: %10 büyük ana parça, %30 orta, %60 küçük. */
function sizeTier(ph: number): number {
  const h = frac(ph * 0.15915494);
  return h < 0.1 ? 1.25 : h < 0.4 ? 1.0 : 0.8;
}

/* ── Pişmiş yardımcılar (tema parıltısı, kıvılcım, parlama) ─────────────── */
const glowCache = new Map<number, HTMLCanvasElement>();
const sparkCache = new Map<number, HTMLCanvasElement>();
let glintCache: HTMLCanvasElement | null = null;
let flashCache: HTMLCanvasElement | null = null;

/** Sprite arkası kontrollü parıltı (1.3x kapsam, düşük yoğunluk). */
function themeGlowDot(kind: number): HTMLCanvasElement {
  const hit = glowCache.get(kind);
  if (hit) return hit;
  const e = mkc();
  const x = e.getContext('2d')!;
  const c = THEME_GLOW[kind] ?? '#ffffff';
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, rgba(c, 0.38));
  g.addColorStop(0.55, rgba(c, 0.14));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowCache.set(kind, e);
  return e;
}

/** Tema renginde mikro kıvılcım/toplama parçacığı noktası. */
function themeSparkDot(kind: number): HTMLCanvasElement {
  const hit = sparkCache.get(kind);
  if (hit) return hit;
  const e = document.createElement('canvas');
  e.width = 16;
  e.height = 16;
  const x = e.getContext('2d')!;
  const c = THEME_GLOW[kind] ?? '#ffffff';
  const g = x.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.5, rgba(c, 0.7));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, 16, 16);
  sparkCache.set(kind, e);
  return e;
}

/** Beyaz parlama noktası (taşan yemler + rozet önizlemesi için). */
function glintDot(): HTMLCanvasElement {
  if (glintCache) return glintCache;
  const S = 32;
  const m = S / 2;
  const e = document.createElement('canvas');
  e.width = S;
  e.height = S;
  const x = e.getContext('2d')!;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.4, 'rgba(234,251,255,.5)');
  g.addColorStop(1, 'rgba(234,251,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  glintCache = e;
  return e;
}

/** Çarpma parlaması diski. */
function whiteFlash(): HTMLCanvasElement {
  if (flashCache) return flashCache;
  const e = mkc();
  const x = e.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.35, 'rgba(234,251,255,.45)');
  g.addColorStop(1, 'rgba(77,201,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  flashCache = e;
  return e;
}

/* ── Karelik bütçeler (SERT üst sınırlar) ─────────────────────────────────
 * Mikro kıvılcım + sprite'lı yem sayısı kare başına sınırlı. Oyun/galeri
 * her kare başında resetDeathBudget() çağırır. Düşük kalitede kıvılcım
 * bütçesi 0 (sprite'lar çizilir, parıltı/kıvılcım kapalı). */
let sparkBudget = 0;
let spriteDraws = 0;
export function resetDeathBudget(): void {
  const g = qGlow();
  sparkBudget = g <= 0 ? 0 : g < 1 ? 500 : 1200;
  spriteDraws = 0;
}
function takeSpark(n = 1): boolean {
  if (sparkBudget < n) return false;
  sparkBudget -= n;
  return true;
}

/** Doğuş animasyonu: kendi konumundan kısa süzülme + aşmalı ölçek + fade.
 * Mantıksal konuma DOKUNMAZ (toplama/çarpışma ilk anda finaldir); yalnızca
 * çizim ofseti/ölçek/opaklık/açı döner. Sakin modda direkt son kare. */
function spawnAnim(p: BluePellet, time: number): {
  px: number; py: number; t: number; scale: number; alpha: number; ang: number;
} {
  const rot0 = groundAngle(p.ph);
  const h2 = frac(p.ph * 0.6180339887);
  const twist = (h2 - 0.5) * TWIST;
  if (fxCalm()) return { px: p.x, py: p.y, t: 1, scale: 1, alpha: 1, ang: rot0 + twist };
  const age = time - p.born;
  const tt = age >= SETTLE_DUR ? 1 : Math.max(0, age / SETTLE_DUR);
  const e = 1 - (1 - tt) * (1 - tt) * (1 - tt); // ease-out kübik
  const h3 = frac(p.ph * 0.3819660113);
  const h4 = frac(p.ph * 0.2795084972);
  const dir = h3 * TAU;
  const dist = DRIFT_MIN + h4 * (DRIFT_MAX - DRIFT_MIN);
  const back = dist * (1 - e);
  // Ölçek: easeOutBack (0.2'den ~1.07 aşmayla 1'e oturur).
  const u = 1 - tt;
  const back3 = 1 - (BACK_C + 1) * u * u * u + BACK_C * u * u;
  const scale = SPAWN_SCALE0 + (1 - SPAWN_SCALE0) * back3;
  return {
    px: p.x + Math.cos(dir) * back,
    py: p.y + Math.sin(dir) * back,
    t: e,
    scale,
    alpha: Math.max(0, Math.min(1, age / FADE_IN)),
    ang: rot0 + twist * e,
  };
}

/** Uçuş kuyruk izi: o anki konumun gerisine solan hayaletler (bütçeli). */
function drawTrail(
  cx: CanvasRenderingContext2D,
  spr: HTMLCanvasElement,
  px: number,
  py: number,
  ox: number,
  oy: number,
  s: number,
  t: number,
  n: number,
  alpha: number,
): void {
  if (t >= 1) return;
  const dx = px - ox;
  const dy = py - oy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  for (let j = 1; j <= n; j++) {
    if (!takeSpark(1)) return;
    const back = j * s * 0.55;
    const gx = px - ux * back;
    const gy = py - uy * back;
    cx.globalAlpha = alpha * (1 - j / (n + 1)) * (1 - t * 0.4);
    cx.drawImage(spr, gx - s, gy - s, s * 2, s * 2);
  }
  cx.globalAlpha = 1;
}

/**
 * Efektli yem çizimi. Sprite hazırsa çizer (true), hazır değilse false
 * döner (çağıran düz yem çizer, oyun bozulmaz). Tavan aşılırsa küçük
 * parıltı noktasına düşer (true). pxPerWorld = DPR * kamera zoom'u.
 */
export function drawDeathFx(
  cx: CanvasRenderingContext2D,
  f: BluePellet,
  r: number,
  time: number,
  pxPerWorld: number,
): boolean {
  const kind = f.fx;
  const sp = deathSprite(kind);
  if (!sp) {
    void ensureDeathSprite(kind);
    return false;
  }
  const calm = fxCalm();
  const simple = qGlow() <= 0;
  if (spriteDraws >= SPRITE_CAP) {
    // Tavan: küçük tema parıltısı (leke değil, nokta).
    const g = themeGlowDot(kind);
    const ds = r * 2.2;
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = 0.5;
    cx.drawImage(g, f.x - ds, f.y - ds, ds * 2, ds * 2);
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = 'source-over';
    return true;
  }
  spriteDraws++;
  const h = frac(f.ph * 0.15915494);
  const h2 = frac(f.ph * 0.6180339887);
  const a = spawnAnim(f, time);
  const flying = a.t < 1;
  // Ölçek: kademe × nabız × doğuş animasyonu (yalnızca görsel).
  const pulse = calm ? 1 : 1 + PULSE_AMP * Math.sin(time * PULSE_HZ + f.ph);
  const E = r * SPRITE_K * sizeTier(f.ph) * pulse * a.scale;
  const half = E / 2;
  // Parıltı: yerleşmişte düşük, ilk pencerede biraz güçlü, sonra kısılır.
  // Sakin modda sabit ve çok hafif; düşük kalitede kapalı.
  if (!simple) {
    const g = themeGlowDot(kind);
    const gs = half * GLOW_R;
    let gi = calm ? GLOW_CALM : GLOW_BASE + 0.04 * Math.sin(time * 1.6 + f.ph);
    if (!calm) {
      const age = time - f.born;
      if (age < GLOW_WINDOW) gi += GLOW_BOOST * (1 - age / GLOW_WINDOW);
    }
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = Math.max(0, gi);
    cx.drawImage(g, a.px - gs, a.py - gs, gs * 2, gs * 2);
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = 'source-over';
  }
  const mip = spriteMip(sp, Math.max(16, E * pxPerWorld));
  cx.save();
  cx.translate(a.px, a.py);
  cx.rotate(a.ang);
  cx.globalAlpha = a.alpha;
  cx.drawImage(mip, -half, -half, E, E);
  cx.restore();
  cx.globalAlpha = 1;
  if (calm || simple) return true;
  const px = a.px;
  const py = a.py;
  // Evreli parlama: her yem kendi fazında (eşzaman yok).
  if (h < 0.6) {
    const blink = 0.5 + 0.5 * Math.sin(time * 3.1 + f.ph * 2);
    const dot = glintDot();
    const ds = E * 0.22;
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = (0.25 + 0.55 * blink * blink) * 0.8;
    cx.drawImage(dot, px - ds, py - ds, ds * 2, ds * 2);
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = 'source-over';
  }
  // Mikro kıvılcım: büyüklerde 1 yükselen + uçuşta 1 (bütçeli, toplam sınırlı).
  const bigSettled = !flying && h < 0.1;
  if ((flying && h2 < 0.3) || bigSettled) {
    if (takeSpark(1)) {
      const sd = themeSparkDot(kind);
      const rise = frac(time * 0.5 + h2);
      const sx = px + Math.sin(h2 * TAU + time * 3) * E * 0.2;
      const sy = py - rise * E * 0.7;
      const ss = E * 0.09;
      cx.globalCompositeOperation = 'lighter';
      cx.globalAlpha = (1 - rise) * 0.8;
      cx.drawImage(sd, sx - ss, sy - ss, ss * 2, ss * 2);
      cx.globalAlpha = 1;
      cx.globalCompositeOperation = 'source-over';
    }
  }
  if (!flying) return true;
  // Kısa kuyruk izi: süzülme başlangıcının gerisi (bütçeli).
  const h3 = frac(f.ph * 0.3819660113);
  const h4 = frac(f.ph * 0.2795084972);
  const ddir = h3 * TAU;
  const ddist = DRIFT_MIN + h4 * (DRIFT_MAX - DRIFT_MIN);
  drawTrail(cx, mip, px, py, f.x + Math.cos(ddir) * ddist, f.y + Math.sin(ddir) * ddist, half, a.t, TRAIL_N, 0.3);
  return true;
}

/**
 * Uçan yem (toplama uçuşu): sprite varsa döndürülmüş çizer, yoksa false.
 * rot = yerdeki sabit duruş açısı (uçuşta tema paleti sürer).
 */
export function drawDeathSpriteFrame(
  cx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  E: number,
  angle: number,
  pxPerWorld: number,
): boolean {
  const sp = deathSprite(kind);
  if (!sp) {
    void ensureDeathSprite(kind);
    return false;
  }
  const mip = spriteMip(sp, Math.max(16, E * pxPerWorld));
  const half = E / 2;
  cx.save();
  cx.translate(x, y);
  cx.rotate(angle);
  cx.drawImage(mip, -half, -half, E, E);
  cx.restore();
  return true;
}

/**
 * Ölüm şoku: genişleyen ince halka + kısa beyaz parlama.
 * Süre dolunca false döner (liste süpürülür). Sakin modda çağrılmaz.
 */
export function drawShock(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  age: number,
): boolean {
  const t = age / SHOCK_DUR;
  if (t >= 1 || t < 0) return false;
  const e = 1 - (1 - t) * (1 - t) * (1 - t);
  cx.globalAlpha = 0.55 * (1 - t);
  cx.strokeStyle = '#eafbff';
  cx.lineWidth = 3 / z;
  cx.beginPath();
  cx.arc(x, y, 26 + 120 * e, 0, TAU);
  cx.stroke();
  if (qGlow() > 0) {
    const fr = 46 * (1 - 0.4 * t);
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = 0.5 * (1 - t);
    cx.drawImage(whiteFlash(), x - fr, y - fr, fr * 2, fr * 2);
    cx.globalCompositeOperation = 'source-over';
  }
  cx.globalAlpha = 1;
  return true;
}

/**
 * Toplama patlaması: tema renginde kısa ömürlü parçacık.
 * Süre dolunca false döner. Sakin modda çağrılmaz.
 */
export function drawBurst(cx: CanvasRenderingContext2D, b: Burst, age: number): boolean {
  const t = age / b.life;
  if (t >= 1 || t < 0) return false;
  const bx = b.x + b.vx * age;
  const by = b.y + b.vy * age - 60 * age * age;
  const s = 7 * (1 - 0.5 * t);
  cx.globalCompositeOperation = 'lighter';
  cx.globalAlpha = (1 - t) * 0.9 * (0.75 + 0.25 * Math.sin(age * 40 + b.sd * TAU));
  cx.drawImage(themeSparkDot(b.fx), bx - s, by - s, s * 2, s * 2);
  cx.globalAlpha = 1;
  cx.globalCompositeOperation = 'source-over';
  return true;
}

/** Rozet statik önizlemesi: sprite hazırsa o, değilse tema parıltısı. */
export function paintDeathBadge(cv: HTMLCanvasElement, spriteId: string): void {
  const kind = deathFxFor(spriteId);
  if (!kind) return;
  const x = cv.getContext('2d');
  if (!x) return;
  const W = cv.width;
  const H = cv.height;
  x.clearRect(0, 0, W, H);
  const sp = deathSprite(kind);
  if (sp) {
    const s = Math.min(W, H) * 0.42;
    x.save();
    x.translate(W / 2, H / 2);
    x.rotate(-0.3);
    x.drawImage(sp.img, -s, -s, s * 2, s * 2);
    x.restore();
  } else {
    void ensureDeathSprite(kind).then(() => paintDeathBadge(cv, spriteId));
    const g = themeGlowDot(kind);
    x.globalAlpha = 0.8;
    x.drawImage(g, 0, 0, W, H);
    x.globalAlpha = 1;
  }
  const dot = glintDot();
  const ds = 4;
  x.globalAlpha = 0.9;
  x.drawImage(dot, W * 0.72 - ds, H * 0.62 - ds, ds * 2, ds * 2);
  x.globalAlpha = 1;
}

/** Rozet animasyon karesi: hafif salınımlı sprite + yanıp sönen parlama. */
export function drawBadgeFrame(cv: HTMLCanvasElement, spriteId: string, time: number): void {
  const kind = deathFxFor(spriteId);
  if (!kind) return;
  const sp = deathSprite(kind);
  if (!sp) {
    void ensureDeathSprite(kind).then(() => paintDeathBadge(cv, spriteId));
    return;
  }
  const x = cv.getContext('2d');
  if (!x) return;
  const W = cv.width;
  const H = cv.height;
  x.clearRect(0, 0, W, H);
  const calm = fxCalm();
  const rock = calm ? 0 : Math.sin(time * 1.8) * 0.15;
  const pulse = calm ? 1 : 1 + 0.06 * Math.sin(time * 2.6);
  const s = Math.min(W, H) * 0.42 * pulse;
  x.save();
  x.translate(W / 2, H * 0.54);
  x.rotate(-0.3 + rock);
  x.drawImage(sp.img, -s, -s, s * 2, s * 2);
  x.restore();
  if (!calm && qGlow() > 0) {
    const dot = glintDot();
    const blink = 0.5 + 0.5 * Math.sin(time * 3.4);
    const ds = 4 + blink * 2;
    x.globalAlpha = 0.4 + 0.5 * blink;
    x.drawImage(dot, W * 0.72 - ds, H * 0.6 - ds, ds * 2, ds * 2);
    x.globalAlpha = 1;
  }
}

// Sprite tabanlı skinler (baş + tekrar eden gövde parçası + kuyruk) ve hareket efektleri.
// Düz renkli skinlere dokunmaz: yalnızca SKIN_DEFS'te `sprite` alanı olan skinler
// buraya düşer. Görseller yüklenene kadar getSpriteSet() null döner ve
// RenderSystem eski daire çizimine geri düşer.
//
// Tüm sprite'lar SAĞA (+x) bakar: baş sağda, kuyruk solda. Bu yüzden çizimde
// ekstra açı düzeltmesi yok; rotate(ang) yeter.
//
// YENİ SKİN EKLEMEK İÇİN: 3 görseli (head/body/tail) src/assets/skins/<id>/ altına koy,
// aşağıdaki SPECS'e bir kayıt ekle, SKIN_DEFS'e `sprite: '<id>'` ile bir satır ekle.
import krampusHead from '../assets/skins/krampus/head.webp';
import krampusBody from '../assets/skins/krampus/body.webp';
import krampusTail from '../assets/skins/krampus/tail.webp';
import cygnusHead from '../assets/skins/cygnus/head.webp';
import cygnusBody from '../assets/skins/cygnus/body.webp';
import cygnusTail from '../assets/skins/cygnus/tail.webp';
import wolfHead from '../assets/skins/werewolf/head.webp';
import wolfBody from '../assets/skins/werewolf/body.webp';
import wolfTail from '../assets/skins/werewolf/tail.webp';
import xenHead from '../assets/skins/Purple XEN/head.webp';
import xenBody from '../assets/skins/Purple XEN/body.webp';
import xenTail from '../assets/skins/Purple XEN/tail.webp';
import redHead from '../assets/skins/Red Wolf/head.webp';
import redBody from '../assets/skins/Red Wolf/body.webp';
import redTail from '../assets/skins/Red Wolf/tail.webp';
import pinkHead from '../assets/skins/Pink Dragon/head.webp';
import pinkBody from '../assets/skins/Pink Dragon/body.webp';
import pinkTail from '../assets/skins/Pink Dragon/tail.webp';
import greenHead from '../assets/skins/Green Dragon/head.webp';
import greenBody from '../assets/skins/Green Dragon/body.webp';
import greenTail from '../assets/skins/Green Dragon/tail.webp';
import blueHead from '../assets/skins/Blue Dragon/head.webp';
import blueBody from '../assets/skins/Blue Dragon/body.webp';
import blueTail from '../assets/skins/Blue Dragon/tail.webp';
import type { Snake } from '../entities/Snake.ts';
import { getSnakeFx, runSkinFx } from './SkinFx.ts';
import type { FxCfg } from './SkinFx.ts';

interface SpriteSpec {
  head: string;
  body: string;
  tail: string;
  /** Gövde parçasında tek tüy kümesinin uzunluğu (px) = çizim adımı. */
  period: number;
  /** Gövde parçasının toplam uzunluğu (px) = period + tail tarafı taşma. */
  bodyLen: number;
  /** Gövde parçasının kalınlığı (px). */
  thick: number;
  /** Gövde parçasının SOL (kuyruk tarafı) kenarındaki yumuşak solma genişliği (px).
   *  Parçalar bu bölgede bir öncekinin SERT sağ kenarının üstüne biner; sert kenar
   *  solma bölgesinin dışında kalmazsa dikiş çizgisi görünür. Kuyruk birleşimi de
   *  bu değere göre hizalanır. */
  fade: number;
  /** Oyundaki kalınlık = 2 * yarıçap * width. 1.3 = tüyler hitbox'ın biraz dışına taşar. */
  width: number;
  /** Baş/kuyruk sprite'ında yılanın "merkez" noktasının x'i (px). */
  headAx: number;
  tailAx: number;
  /** Sprite'ta omurganın dikey konumu (px). Verilmezse görselin ortası. */
  headAy?: number;
  tailAy?: number;
  bodyAy?: number;
  headScale: number;
  /** Kuyruk sallanması: genlik (radyan) ve hız. Alev titremesi / kurt kuyruğu. */
  tailWag?: { amp: number; freq: number };
  /** Gittikçe çıkan parçacık efekti. */
  fx?: FxCfg;
}

const SPECS: Record<string, SpriteSpec> = {
  // ❄ Karlı: ince buz parçacıkları, hafifçe aşağı süzülür.
  krampus: {
    head: krampusHead,
    body: krampusBody,
    tail: krampusTail,
    period: 86,
    bodyLen: 112,
    thick: 137,
    fade: 17,
    width: 1.3,
    headAx: 120,
    tailAx: 85,
    headScale: 1.15,
    fx: {
      colors: ['#bfe9ff', '#8fd3ff', '#ffffff'],
      sparkChance: 0.35,
      rate: 0.16,
      boostMul: 1.8,
      life: [0.8, 1.5],
      size: [0.22, 0.5],
      rise: -0.4,
      spread: 0.35,
      bodyBias: 1,
      tailShare: 0.1,
      twinkle: true,
      shrink: false,
    },
  },

  // ✦ Cygnus: mor/yeşil yıldız kıvılcımları, kuyruktan yükselen alev közleri, parlak gözler.
  cygnus: {
    head: cygnusHead,
    body: cygnusBody,
    tail: cygnusTail,
    period: 74,
    bodyLen: 100,
    thick: 119,
    fade: 17,
    width: 1.3,
    headAx: 100,
    headAy: 59,
    tailAx: 104,
    tailAy: 57,
    bodyAy: 52,
    headScale: 1.2,
    tailWag: { amp: 0.16, freq: 7 },
    fx: {
      colors: ['#ff7be5', '#b46bff', '#4dffd0', '#ffe14a'],
      tailColors: ['#ffb347', '#ff7be5', '#ffe14a'],
      sparkChance: 0.7,
      rate: 0.24,
      boostMul: 2,
      life: [0.7, 1.4],
      size: [0.4, 0.9],
      rise: 0.25,
      spread: 0.4,
      bodyBias: 1,
      tailShare: 0.25,
      twinkle: true,
      shrink: false,
      headGlow: { color: '#7ff7ff', forward: 0.4, size: 1.4, pulse: 0.12, alpha: 0.22 },
    },
  },

  // 🔥 Kurt: yükselen kor/kıvılcım, kuyruk sallanır, gözler kızarır.
  werewolf: {
    head: wolfHead,
    body: wolfBody,
    tail: wolfTail,
    period: 88,
    bodyLen: 116,
    thick: 138,
    fade: 40,
    width: 1.3,
    headAx: 116,
    headAy: 79,
    tailAx: 119,
    tailAy: 60,
    bodyAy: 60,
    headScale: 1.15,
    tailWag: { amp: 0.22, freq: 4.5 },
    fx: {
      colors: ['#ff3b30', '#ff7a1a', '#ffc14a'],
      sparkChance: 0.15,
      rate: 0.26,
      boostMul: 2.2,
      life: [0.55, 1.2],
      size: [0.3, 0.7],
      rise: 0.8,
      spread: 0.35,
      bodyBias: 1.2,
      tailShare: 0.25,
      twinkle: false,
      shrink: true,
      headGlow: { color: '#ff2a1a', forward: 0.35, size: 1.7, pulse: 0.2, alpha: 0.3 },
    },
  },

  // ✦ Purple XEN: mor/cyan yıldız kıvılcımları, kuyruktan alev közleri, parlak gözler.
  xen: {
    head: xenHead,
    body: xenBody,
    tail: xenTail,
    period: 87,
    bodyLen: 114,
    thick: 140,
    fade: 26,
    width: 1.3,
    headAx: 175,
    headAy: 92,
    tailAx: 193,
    tailAy: 70,
    bodyAy: 70,
    headScale: 1.15,
    tailWag: { amp: 0.16, freq: 7 },
    fx: {
      colors: ['#c084fc', '#4dffd0', '#ff7be5', '#7ff7ff'],
      tailColors: ['#4dffd0', '#c084fc', '#7ff7ff'],
      sparkChance: 0.7,
      rate: 0.24,
      boostMul: 2,
      life: [0.7, 1.4],
      size: [0.4, 0.9],
      rise: 0.25,
      spread: 0.4,
      bodyBias: 1,
      tailShare: 0.25,
      twinkle: true,
      shrink: false,
      headGlow: { color: '#7ff7ff', forward: 0.4, size: 1.4, pulse: 0.12, alpha: 0.22 },
    },
  },

  // 🔥 Red Wolf: yükselen kor/kıvılcım, kuyruk sallanır, gözler kızarır.
  redwolf: {
    head: redHead,
    body: redBody,
    tail: redTail,
    period: 77,
    bodyLen: 102,
    thick: 140,
    fade: 24,
    width: 1.3,
    headAx: 150,
    headAy: 92,
    tailAx: 225,
    tailAy: 70,
    bodyAy: 70,
    headScale: 1.15,
    tailWag: { amp: 0.22, freq: 4.5 },
    fx: {
      colors: ['#ff3b30', '#ff7a1a', '#ffc14a'],
      sparkChance: 0.15,
      rate: 0.26,
      boostMul: 2.2,
      life: [0.55, 1.2],
      size: [0.3, 0.7],
      rise: 0.8,
      spread: 0.35,
      bodyBias: 1.2,
      tailShare: 0.25,
      twinkle: false,
      shrink: true,
      headGlow: { color: '#ff2a1a', forward: 0.35, size: 1.7, pulse: 0.2, alpha: 0.3 },
    },
  },

  // 🌸 Pink Dragon: pembe/mor yıldız kıvılcımları, alev kuyruk, parlak gözler.
  pinkdragon: {
    head: pinkHead,
    body: pinkBody,
    tail: pinkTail,
    period: 59,
    bodyLen: 77,
    thick: 140,
    fade: 18,
    width: 1.3,
    headAx: 159,
    headAy: 92,
    tailAx: 213,
    tailAy: 70,
    bodyAy: 70,
    headScale: 1.15,
    tailWag: { amp: 0.18, freq: 6 },
    fx: {
      colors: ['#ff7be5', '#ff4da6', '#ffb3dd', '#c084fc'],
      tailColors: ['#ff7be5', '#ff4da6', '#ffe14a'],
      sparkChance: 0.6,
      rate: 0.24,
      boostMul: 2,
      life: [0.7, 1.4],
      size: [0.4, 0.9],
      rise: 0.3,
      spread: 0.4,
      bodyBias: 1,
      tailShare: 0.25,
      twinkle: true,
      shrink: false,
      headGlow: { color: '#ff7be5', forward: 0.4, size: 1.4, pulse: 0.12, alpha: 0.22 },
    },
  },

  // 🐉 Green Dragon: yeşil/cam kıvılcımlar, alev kuyruk, parlak gözler.
  greendragon: {
    head: greenHead,
    body: greenBody,
    tail: greenTail,
    period: 58,
    bodyLen: 76,
    thick: 140,
    fade: 18,
    width: 1.3,
    headAx: 155,
    headAy: 92,
    tailAx: 220,
    tailAy: 70,
    bodyAy: 70,
    headScale: 1.15,
    tailWag: { amp: 0.18, freq: 6 },
    fx: {
      colors: ['#4dff6a', '#b6ff4d', '#4dffd0', '#eaffea'],
      tailColors: ['#b6ff4d', '#4dff6a', '#eaffea'],
      sparkChance: 0.6,
      rate: 0.24,
      boostMul: 2,
      life: [0.7, 1.4],
      size: [0.4, 0.9],
      rise: 0.3,
      spread: 0.4,
      bodyBias: 1,
      tailShare: 0.25,
      twinkle: true,
      shrink: false,
      headGlow: { color: '#4dff6a', forward: 0.4, size: 1.4, pulse: 0.12, alpha: 0.22 },
    },
  },

  // 🐲 Blue Dragon: mavi/cyan kıvılcımlar, alev kuyruk, parlak gözler.
  bluedragon: {
    head: blueHead,
    body: blueBody,
    tail: blueTail,
    period: 76,
    bodyLen: 101,
    thick: 140,
    fade: 24,
    width: 1.3,
    headAx: 180,
    headAy: 92,
    tailAx: 205,
    tailAy: 70,
    bodyAy: 70,
    headScale: 1.15,
    tailWag: { amp: 0.18, freq: 6 },
    fx: {
      colors: ['#4dc9ff', '#3fa7ff', '#7ff7ff', '#b46bff'],
      tailColors: ['#4dc9ff', '#7ff7ff', '#b46bff'],
      sparkChance: 0.6,
      rate: 0.24,
      boostMul: 2,
      life: [0.7, 1.4],
      size: [0.4, 0.9],
      rise: 0.3,
      spread: 0.4,
      bodyBias: 1,
      tailShare: 0.25,
      twinkle: true,
      shrink: false,
      headGlow: { color: '#4dc9ff', forward: 0.4, size: 1.4, pulse: 0.12, alpha: 0.22 },
    },
  },
};

export interface SpriteSet {
  spec: SpriteSpec;
  head: HTMLImageElement;
  body: HTMLImageElement;
  tail: HTMLImageElement;
  /** Bağlantı (sağ) kenarı yumuşatılmış kuyruk kopyası (ilk kullanımda bir kez üretilir). */
  tailF?: HTMLCanvasElement | null;
  tailFDone?: boolean;
}

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img;
}

const SETS = new Map<string, SpriteSet>();
for (const id of Object.keys(SPECS)) {
  const spec = SPECS[id];
  SETS.set(id, { spec, head: load(spec.head), body: load(spec.body), tail: load(spec.tail) });
}

const ok = (i: HTMLImageElement): boolean => i.complete && i.naturalWidth > 0;

/** Kuyruk görselinin bağlantı (sağ) kenarına alfa gradyanı uygular. Sert kenar
 *  çizgisi kaybolur; gövde parçası zaten üstüne bindiği için geometri ve
 *  SPECS ölçüleri değişmez. Set başına BİR kez üretilir, kare başına canvas YOK. */
function featheredTail(set: SpriteSet): HTMLCanvasElement | null {
  if (set.tailF) return set.tailF;
  if (set.tailFDone || !ok(set.tail)) return null;
  set.tailFDone = true;
  const w = set.tail.naturalWidth, h = set.tail.naturalHeight;
  const e = document.createElement('canvas');
  e.width = w; e.height = h;
  const x = e.getContext('2d')!;
  x.drawImage(set.tail, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  const f = Math.max(8, Math.round(w * 0.15));
  const g = x.createLinearGradient(w - f, 0, w, 0);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
  set.tailF = e;
  return e;
}

/** Yüklendiyse sprite setini, değilse (veya sprite skin değilse) null döndürür. */
export function getSpriteSet(id: string | undefined): SpriteSet | null {
  if (!id) return null;
  const s = SETS.get(id);
  return s && ok(s.head) && ok(s.body) && ok(s.tail) ? s : null;
}

/** Tüm sprite'lar yüklenince çözülür. Menü önizlemelerini yeniden çizmek için. */
export function preloadSkinSprites(): Promise<void> {
  const all: Promise<unknown>[] = [];
  for (const s of SETS.values()) {
    for (const img of [s.head, s.body, s.tail]) {
      // Eski tarayıcıda HTMLImageElement.decode yoktur; senkron fırlatırdı.
      const d = (img as HTMLImageElement & { decode?: () => Promise<unknown> }).decode?.();
      all.push(d ? d.catch(() => undefined) : Promise.resolve());
    }
  }
  return Promise.all(all).then(() => undefined);
}

function put(
  cx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  ax: number,
  ay: number,
  x: number,
  y: number,
  ang: number,
  k: number,
): void {
  cx.save();
  cx.translate(x, y);
  cx.rotate(ang);
  cx.scale(k, k);
  cx.drawImage(img, -ax, -ay);
  cx.restore();
}

/** Gövde parçası adımı: parçanın SERT sağ kenarı, sonraki parçanın solma bölgesinin
 *  dışında kalmalı (bodyLen - adım >= fade), yoksa dikiş görünür. */
function stepOf(sp: SpriteSpec): number {
  return Math.min(sp.period, sp.bodyLen - sp.fade - 2);
}

/** Baş ile kuyruk uçlarının, yılanın omurga uçlarından ne kadar taştığı (k0 = 1 birimi, px).
 *  Menü önizlemelerini (küçük kutu) kırpmadan sığdırmak için kullanılır. */
export function spriteReach(set: SpriteSet): { head: number; tail: number; halfH: number } {
  const sp = set.spec;
  const hh = set.head.naturalHeight || 140;
  return {
    head: (set.head.naturalWidth - sp.headAx) * sp.headScale,
    tail: sp.tailAx,
    halfH: Math.max(sp.thick, hh * sp.headScale) / 2,
  };
}

/** Sprite skinlerde gövde/kuyruk ölçeği: sona doğru çok hafif incelir. Kuyruk ve komşu
 *  gövde parçası AYNI değeri kullandığı için birleşimde kalınlık sıçraması olmaz. */
function spriteTaper(s: Snake, i: number): number {
  return 0.86 + 0.14 * Math.min(1, Math.max(0, (s.dlen - (i + 1) * s.sp) / (14 * s.sp)));
}

/** Yılanı sprite'larla çizer: önce kuyruk, sonra gövde (kuyruktan başa), sonra baş, en son efekt. */
export function drawSpriteSnake(
  cx: CanvasRenderingContext2D,
  s: Snake,
  set: SpriteSet,
  vx0: number,
  vx1: number,
  vy0: number,
  vy1: number,
): void {
  const b = s.body;
  const bn = s.bn;
  if (bn < 2) return;
  const sp = set.spec;
  const k0 = (2 * s.r * sp.width) / sp.thick;
  const P = stepOf(sp);
  const pad = s.r * 3;

  // i < 0 => baş; i >= bn => son nokta. 0 baş'a en yakın gövde noktası.
  const px = (i: number): number => (i < 0 ? s.x : b[Math.min(i, bn - 1) * 2]);
  const py = (i: number): number => (i < 0 ? s.y : b[Math.min(i, bn - 1) * 2 + 1]);
  const heading = (i: number): number => Math.atan2(py(i - 1) - py(i + 1), px(i - 1) - px(i + 1));
  const vis = (x: number, y: number): boolean =>
    x > vx0 - pad && x < vx1 + pad && y > vy0 - pad && y < vy1 + pad;

  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';

  const last = bn - 1;
  const kT = k0 * spriteTaper(s, last);

  // Kuyruk görselinin SERT sağ kenarı ile gövdenin ilk parçasının solma bölgesi çakışır:
  //   solma bölgesi kuyruk görselinin en sağ (fade + 4) px'ine oturur, böylece
  //   gövde kuyruğun ÜSTÜNE yumuşakça biner ve sert kenar gövdenin altında kalır.
  const tW = set.tail.naturalWidth;
  const lb = tW - sp.fade - 4 - sp.tailAx; // ilk parçanın sol kenarı (kuyruk çıpasından, k0=1 birimi)
  const c0 = lb + (sp.bodyLen - P / 2); // ilk parçanın merkezi

  // 1) kuyruk
  const tx = px(last);
  const ty = py(last);
  if (vis(tx, ty)) {
    // Kuyruk yönü: son birkaç noktanın kirişi (tek segmentlik yön titrer, virajda kuyruk kırılır).
    const span = Math.max(2, Math.min(last, Math.round(((tW - sp.tailAx) * kT) / s.sp)));
    const ang = Math.atan2(py(last - span) - ty, px(last - span) - tx);
    const w = sp.tailWag;
    const wag = w ? w.amp * Math.sin((performance.now() / 1000) * w.freq * (1 + 0.8 * s.fx) + s.id) : 0;
    // Sallanma, kuyruğun gövdeye gömülü kısmında (birleşim) döner: uç sallanır, birleşim yerinde kalır.
    const pv = (tW - 6 - sp.tailAx) * kT;
    cx.save();
    cx.translate(tx, ty);
    cx.rotate(ang);
    cx.translate(pv, 0);
    cx.rotate(wag);
    cx.translate(-pv, 0);
    cx.scale(kT, kT);
    cx.drawImage(featheredTail(set) ?? set.tail, -sp.tailAx, -(sp.tailAy ?? set.tail.naturalHeight / 2));
    cx.restore();
  }

  // 2) gövde: kuyruktan başa; her parça bir öncekinin üstüne biner.
  const bAy = sp.bodyAy ?? sp.thick / 2;
  let f = last - (c0 * kT) / s.sp;
  for (; f > 0; ) {
    const i0 = Math.floor(f);
    const fr = f - i0;
    const x = px(i0) * (1 - fr) + px(i0 + 1) * fr;
    const y = py(i0) * (1 - fr) + py(i0 + 1) * fr;
    const k = k0 * spriteTaper(s, i0);
    if (vis(x, y)) put(cx, set.body, sp.bodyLen - P / 2, bAy, x, y, heading(i0), k);
    f -= (P * k) / s.sp;
  }

  // 3) baş (gövdenin üstünde)
  put(cx, set.head, sp.headAx, sp.headAy ?? set.head.naturalHeight / 2, s.x, s.y, s.ang, k0 * sp.headScale);

  // 4) hareket efekti (parçacıklar + baş parlaması)
  const fxc = getSnakeFx(s) ?? sp.fx;
  if (fxc) runSkinFx(cx, s, fxc, vx0, vx1, vy0, vy1);
}

// Vitrin — menünün kahraman katmanı.
//
// Dev bir yılanı, oyunun KENDİ renderer'ı ile çizer. `createSnake` +
// `buildBody` + `drawSnakeBody` — yani segment sıklığı, konik incelme,
// glow ve gözler oyundakiyle birebir aynı kaynaktan gelir. Menü yılanı
// oyun yılanıyla aynı modellenmiştir (ayrı bir çizim dili YOK).
//
// Ayrı canvas + ayrı rAF kullanır. Maliyet: ~50 segment ≈ 1-2 ms.
// Sekme gizlenince durur (web-games: tab throttling).
import { createSnake, buildBody } from '../entities/Snake.ts';
import type { Snake } from '../entities/Snake.ts';
import { drawSnakeBody } from '../systems/RenderSystem.ts';
import { getSpriteSet, spriteReach } from '../systems/SpriteSkins.ts';
import { skinSpriteId } from '../entities/Skin.ts';
import { brand } from './brand.ts';
import { fxCalm, qGlow } from '../utils/settings.ts';

/** Omurga nokta aralığı (px). buildBody bunu yeniden örnekler. */
const DS = 3;

/** Dalga hızı (rad/sn): gövde yerinde, yavaşça ve yumuşakça dalgalanır. */
const OMEGA = 1.05;

/** Baş hafifçe yukarıda dursun (gövde sola doğru hafif alçalır). */
const TILT = -0.1;

/** Gövde dalgasının genliği (rad): baştan kuyruğa doğru artar. */
const AMP = 0.8;

/** Yumuşak marka halesi. pelSprite'ın beyaz çekirdeği olmadan — o bir
 *  dev beyaz leke olurdu. */
function glowSprite(c: string): HTMLCanvasElement {
  const e = document.createElement('canvas');
  e.width = 128;
  e.height = 128;
  const x = e.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, c);
  g.addColorStop(0.4, c + '55');
  g.addColorStop(1, c + '00');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return e;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Vitrin — "Görünüm önizleme" yılanı.
 *
 * Yılan artık ekranda sağa sola GEZMEZ: başı sabit bir noktada durur,
 * gövde yerinde yavaşça dalgalanır (S biçimi). Sahne, ana menünün sağ-orta
 * bölgesidir (başlık sütununun ve liderlik tablosunun arasında).
 */
export class Vitrine {
  private cv: HTMLCanvasElement;
  private cx: CanvasRenderingContext2D;
  private snake: Snake;
  private glow: Record<string, HTMLCanvasElement> = {};
  private raf = 0;
  private last = 0;
  private W = 1;
  private H = 1;
  private DPR = 1;

  /** Dalga fazı (rad). Kilitliyken ilerlemez. */
  private phase = 0.9;
  /** Sabit baş konumu ve sahnenin merkezi. */
  private hx = 0;
  private hy = 0;
  private sx = 0;
  private sy = 0;
  private pts = 2;
  /** Sprite görselleri yüklendi mi (yüklenince baş/kuyruk taşması için yeniden hizalanır). */
  private hadSet = false;

  /** 0 = serbest, 1 = kilitli. Seçim sırasında dalga yumuşakça durur. */
  private hold = 0;
  private holdTarget = 0;

  /**
   * 0 = normal vitrin, 1 = ÖNİZLEME MODU (skin seçilirken/üzerine gelinirken).
   * Üç etki: sıkı spot ışık, hafif büyüme (1.16×), ad levhası.
   */
  private prev = 0;
  private prevTarget = 0;
  /** Ad levhasının bağlı olduğu DÜĞÜM (DOM). */
  private label: HTMLElement | null = null;
  /** Deck'in sağ kenarı + pay: levhanın sol sınırı. */
  private safeL = 0;
  private labelHalf = 90;
  private labelDirty = true;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.cx = cv.getContext('2d')!;
    // bot=false: drawSnakeBody yalnızca botlara isim etiketi çizer.
    this.snake = createSnake('vitrin', 0, false, 120, 0, 0, 0);
    this.resize();
  }

  setSkin(i: number): void {
    this.snake.skin = i;
    this.hadSet = getSpriteSet(skinSpriteId(i)) !== null;
    this.layout();
  }

  /** Seçim sırasında dalgayı yumuşakça durdurur ve önizleme modunu açar. */
  setHold(on: boolean): void {
    this.holdTarget = on ? 1 : 0;
    this.prevTarget = on ? 1 : 0;
  }

  /** Ad levhasının bağlanacağı düğüm. `null` verilirse levhasız çalışır. */
  setLabel(el: HTMLElement | null): void {
    this.label = el;
    this.labelDirty = true;
  }

  /** Deck'in sağ kenarını (+pay) bildirir; levhanın sol sınırıdır. */
  setSafeLeft(x: number): void {
    if (Math.abs(x - this.safeL) > 0.5) this.safeL = x;
  }

  /** Skin adı değişince levhanın genişliğini yeniden ölçmeye zorlar. */
  invalidateLabel(): void {
    this.labelDirty = true;
  }

  resize(): void {
    const W = Math.max(1, window.innerWidth);
    const H = Math.max(1, window.innerHeight);
    this.W = W;
    this.H = H;
    this.DPR = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(W * this.DPR);
    this.cv.height = Math.round(H * this.DPR);

    // Sahne: başlık sütununun sağı, liderlik tablosunun altı.
    const narrow = clamp((W - 390) / (1366 - 390), 0, 1);
    const stageL = W * (0.5 - 0.115 * narrow);
    const stageR = W * 0.92;
    this.sx = (stageL + stageR) / 2;
    this.sy = H * (0.44 + 0.128 * narrow);

    // Ölçek: dar ekranda dev bir yılan ekrandan taşar ve okunmaz olur.
    const k = clamp(Math.min(W / 1360, H / 820), 0.5, 1.15);
    const s = this.snake;
    s.dlen = Math.min(620 * k, (stageR - stageL) * 0.64);
    s.r = Math.min(30 * k, s.dlen / 18);
    s.fx = 0.62;
    this.pts = Math.ceil((s.dlen + 60) / DS) + 1;
    this.layout();
  }

  /** Dalganın baştan itibaren d uzaklığındaki yönü (rad). Baştan GERİYE doğru. */
  private theta(d: number, phase: number): number {
    const L = this.snake.dlen;
    const u = clamp(d / L, 0, 1);
    const e = u * u * (3 - 2 * u);
    const A = AMP * (0.18 + 0.82 * e);
    return Math.PI + TILT + A * Math.sin((2 * Math.PI * d) / (L * 0.78) - phase);
  }

  /**
   * Baş konumunu sabitler: dalganın tüm evreleri sahnenin merkezine
   * ortalanır, böylece yılan dalgalanırken sahneden taşmaz ve yeri kaymaz.
   */
  private layout(): void {
    const s = this.snake;
    let minX = 0;
    let minY = 0;
    let maxY = 0;
    for (let q = 0; q < 12; q++) {
      const ph = (q / 12) * Math.PI * 2;
      let x = 0;
      let y = 0;
      for (let d = 0; d <= s.dlen; d += DS) {
        const th = this.theta(d, ph);
        x += Math.cos(th) * DS;
        y += Math.sin(th) * DS;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    // Baş/kuyruk uçlarının omurgadan taşması (sprite skinlerde uzun).
    let fwd = s.r * 1.4;
    let back = s.r * 1.4;
    const set = getSpriteSet(skinSpriteId(s.skin));
    if (set) {
      const k0 = (2 * s.r * set.spec.width) / set.spec.thick;
      const rc = spriteReach(set);
      fwd = rc.head * k0;
      back = rc.tail * k0;
    }
    const left = minX - back;
    const right = fwd * 1.16;
    this.hx = clamp(this.sx - (left + right) / 2, -left + 16, this.W - right - 16);
    this.hy = this.sy - (minY + maxY) / 2;
    this.pose(this.phase);
  }

  /** Omurgayı verilen evrede kurar; baş (hx, hy) noktasında SABİT kalır. */
  private pose(phase: number): void {
    const s = this.snake;
    const n = this.pts;
    const tx = s.tx;
    const ty = s.ty;
    tx.length = n;
    ty.length = n;
    s.ts = 0;
    let x = this.hx;
    let y = this.hy;
    for (let j = 0; j < n; j++) {
      const idx = n - 1 - j; // baş en yeni nokta
      tx[idx] = x;
      ty[idx] = y;
      const th = this.theta(j * DS, phase);
      x += Math.cos(th) * DS;
      y += Math.sin(th) * DS;
    }
    s.x = this.hx;
    s.y = this.hy;
    s.ang = this.theta(0, phase) + Math.PI;
    s.wang = s.ang;
    buildBody(s);
  }

  private glowOf(c: string): HTMLCanvasElement {
    return (this.glow[c] ??= glowSprite(c));
  }

  private step(dt: number): void {
    const has = getSpriteSet(skinSpriteId(this.snake.skin)) !== null;
    if (has !== this.hadSet) {
      this.hadSet = has;
      this.layout();
    }
    // Kilit yumuşak: ~200 ms'de hedefe oturur, ani donma değil.
    this.hold += (this.holdTarget - this.hold) * Math.min(1, dt * 9);
    if (Math.abs(this.holdTarget - this.hold) < 0.004) this.hold = this.holdTarget;
    const k = dt * (1 - this.hold);
    if (k <= 0) return; // kilit: poz donar
    this.phase += k * OMEGA;
    this.pose(this.phase);
  }

  private draw(): void {
    const { cx, W, H } = this;
    cx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    cx.clearRect(0, 0, W, H);

    const h = { x: this.snake.x, y: this.snake.y };
    const p = this.prev; // 0..1 — önizleme modu
    const G = Math.min(W, H) * 0.55;
    const b = brand();
    // Büyük hale sahnenin merkezinde, sıkı spot başta.
    const c = { x: this.sx, y: this.sy };

    cx.globalCompositeOperation = 'lighter';
    // Kalite düşükse sahne glow'ları atlanır; ortada alfa yarıya iner.
    const gf = qGlow();
    if (gf > 0) {
      cx.globalAlpha = (0.32 + 0.34 * p) * gf;
      cx.drawImage(this.glowOf(b[1]), c.x - G, c.y - G, G * 2, G * 2);
      cx.globalAlpha = (0.2 + 0.2 * p) * gf;
      cx.drawImage(this.glowOf(b[0]), c.x - G * 0.7, c.y - G * 0.7, G * 1.4, G * 1.4);
      cx.globalAlpha = (0.16 + 0.14 * p) * gf;
      cx.drawImage(this.glowOf(b[2]), c.x - G * 0.5, c.y - G * 0.5, G, G);

      if (p > 0.01) {
        const S = this.snake.r * 7;
        cx.globalAlpha = 0.42 * p * gf;
        cx.drawImage(this.glowOf(b[0]), h.x - S, h.y - S, S * 2, S * 2);
        const S2 = this.snake.r * 3.2;
        cx.globalAlpha = 0.55 * p * gf;
        cx.drawImage(this.glowOf(b[2]), h.x - S2, h.y - S2, S2 * 2, S2 * 2);
      }
    }
    cx.globalCompositeOperation = 'source-over';
    cx.globalAlpha = 1;

    // Önizlemede yılan başın etrafında hafifçe büyür; baş yerinde kalır.
    const k = 1 + 0.16 * p;
    cx.save();
    if (k !== 1) {
      cx.translate(h.x, h.y);
      cx.scale(k, k);
      cx.translate(-h.x, -h.y);
    }
    drawSnakeBody(cx, this.snake, 1, -1e5, 1e5, -1e5, 1e5);
    cx.restore();

    // Baş halesi: gözün çevresinde küçük, sıcak bir odak (kalite düşükse yok).
    const BH = this.snake.r * 5 * k;
    if (gf > 0) {
      cx.globalAlpha = (0.4 + 0.35 * p) * gf;
      cx.drawImage(this.glowOf(b[1]), h.x - BH, h.y - BH, BH * 2, BH * 2);
      cx.globalAlpha = 1;
    }

    this.placeLabel(h);
  }

  /**
   * Ad levhasını başın hemen altına taşır. Konum güvenli bir banttan
   * geçirilir (deck'in sağı, liderlik tablosunun altı, alt bilgi şeridinin üstü).
   * `transform`/`opacity` her karede yazılır ama layout OKUNMAZ.
   */
  private placeLabel(h: { x: number; y: number }): void {
    const el = this.label;
    if (!el) return;
    const p = this.prev;
    if (p <= 0.002) return;

    if (this.labelDirty) {
      this.labelHalf = Math.max(40, el.offsetWidth / 2);
      this.labelDirty = false;
    }

    const W = this.W;
    const H = this.H;
    const loY = Math.max(300, H * 0.32);
    const hiY = H - 185;
    const loX = Math.max(this.safeL + this.labelHalf, this.labelHalf + 16);
    const hiX = W - 52 - this.labelHalf;
    if (hiX < loX || hiY < loY) {
      el.style.opacity = '0';
      return;
    }

    const x = clamp(h.x, loX, hiX);
    const y = clamp(h.y + this.snake.r * 2.4, loY, hiY);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateX(-50%)`;
    el.style.opacity = p.toFixed(3);
  }

  /** Önizleme modunu HAM zamanla açar/kapatır (~350 ms). */
  private easePreview(dt: number): void {
    this.prev += (this.prevTarget - this.prev) * Math.min(1, dt * 6);
    if (Math.abs(this.prevTarget - this.prev) < 0.004) this.prev = this.prevTarget;
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.04, this.last ? (now - this.last) / 1000 : 1 / 60);
    this.last = now;
    this.easePreview(dt);
    this.step(fxCalm() ? dt * 0.15 : dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  start(): void {
    if (this.raf) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    document.removeEventListener('visibilitychange', this.onVis);
  }

  private onVis = (): void => {
    // Sekme geri geldiğinde birikmiş zaman farkını at (dev sıçrama olmasın).
    if (!document.hidden) this.last = 0;
    if (document.hidden && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    this.start();
  };

  /** Sekme gizliyken döngüyü durdurur. */
  watchVisibility(): void {
    document.addEventListener('visibilitychange', this.onVis);
  }
}

/** Tek seferlik skin önizlemesi: gerçek gövde, sabit S pozu.
 *  15 yuva × 1 çizim = başlangıçta tek seferlik. */
export function paintSwatch(cv: HTMLCanvasElement, skin: number, dpr: number): void {
  const w = cv.clientWidth || 60;
  const h = cv.clientHeight || 28;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const cx = cv.getContext('2d')!;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, w, h);

  const s = createSnake('s', skin, false, 0, 0, 0, 0);
  s.r = 4.6;
  s.dlen = 104;
  s.fx = 0.62;
  s.ts = 0;
  s.tx.length = 0;
  s.ty.length = 0;
  const N = 220;
  // ── DİKEY ORTALAMA ───────────────────────────────────────────────────
  // Eskiden `s.ty` y=0'da merkezleniyordu ama canvas 0..28 aralığındaydı:
  // yılan tepe kenarına yapışıyor, ÜST YARISI kırpılıyordu.
  //
  //   ölçülen içerik: satır 0..14, merkez 7   (canvas merkezi 13.5)
  //   yani 15/15 yuvada dalga ~7px yukarıda ve tepesi kesikti —
  //   kullanıcının gördüğü "hiçbiri hizalı değil" buydu.
  //
  // `mid = h / 2` ile dalga tam ortalanır. Genlik `0.20 -> 0.14` çekildi:
  // gövde ±(amp + r) ≈ ±9.1px (kenara 4.9px pay) ve onu çevreleyen soluk
  // parlama ±5px. 0.20'de toplam ±14px olduğundan tepe tam ortada bile
  // satır 0'a değip kesiliyordu (ölçüm: 15/15'te minY=0). 0.14 ile
  // ölçülen sonuç: içerik ~1..26, merkez 13.5, iki kenarda da pay var.
  let amp = h * 0.14;
  const mid = h / 2;
  // ── SPRITE SKİNLER: baş ve kuyruk kırpılmasın ────────────────────────
  // Baş sprite'ı omurganın ötesine, kuyruk sprite'ı da gerisine taşar. Eski
  // sabit yerleşim (w*0.12 .. w*0.88) bu taşmayı hesaba katmadığı için baş
  // sağdan, kuyruk soldan kesiliyordu. Burada ölçek, baş+kuyruk taşması
  // genişliğin ~%64'ünü geçmeyecek, kalınlık da kutuya sığacak şekilde
  // seçilir; omurga kalan aralığa yerleştirilir.
  let x0 = w * 0.12;
  let x1 = w * 0.88;
  const set = getSpriteSet(skinSpriteId(skin));
  if (set) {
    const rc = spriteReach(set);
    const kv = (h / 2 - 2.5) / rc.halfH;
    const kh = (w * 0.64) / (rc.head + rc.tail);
    const k0 = Math.min(kv * 0.95, kh);
    s.r = (k0 * set.spec.thick) / (2 * set.spec.width);
    amp = Math.max(0, Math.min(h * 0.14, h / 2 - 2.5 - rc.halfH * k0));
    x0 = 3 + rc.tail * k0;
    x1 = w - 3 - rc.head * k0;
    s.dlen = Math.max(8, x1 - x0 + 2);
  }
  // Baş sağda, kuyruk solda: seçili yuvada göz görünür.
  for (let i = 0; i <= N; i += 3) {
    const u = i / N;
    s.tx.push(x0 + u * (x1 - x0));
    s.ty.push(mid + amp * Math.sin(u * Math.PI * 2.1 + 0.4));
  }
  s.x = s.tx[s.tx.length - 1];
  s.y = s.ty[s.ty.length - 1];
  s.ang = 0;
  s.wang = 0;
  buildBody(s);
  drawSnakeBody(cx, s, 1, -1e5, 1e5, -1e5, 1e5);
}

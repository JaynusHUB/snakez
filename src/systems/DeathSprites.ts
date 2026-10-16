// Ölüm yemi sprite hattı: public/death-food/*.webp lazy load + mip zinciri.
// Yalnızca ihtiyaç anında (ölüm/rozet/galeri) ilgili skin yüklenir;
// yüklenemezse null döner, oyun düz yemle devam eder (bozulmaz).
// Karede shadowBlur/filter YOK: drawImage + önceden küçültülmüş mipler.

const FILES: Record<number, string> = {
  1: 'krampus',
  2: 'werewolf',
  3: 'redwolf',
  4: 'cygnus',
  5: 'xen',
  6: 'pinkdragon',
  7: 'greendragon',
  8: 'bluedragon',
};

/** Tema id -> webp dosya adı (skin eşlemesi için). */
export function deathSpriteFile(kind: number): string | null {
  return FILES[kind] ?? null;
}

export interface DeathSprite {
  kind: number;
  /** 128px ana doku. */
  img: HTMLCanvasElement;
  /** Kademeli yarıya indirme: 128/64/32/16 (bulanık küçültme yok). */
  mips: HTMLCanvasElement[];
}

const cache = new Map<number, DeathSprite>();
const inflight = new Map<number, Promise<DeathSprite | null>>();

function halve(src: HTMLCanvasElement): HTMLCanvasElement {
  const e = document.createElement('canvas');
  e.width = Math.max(1, src.width >> 1);
  e.height = Math.max(1, src.height >> 1);
  const x = e.getContext('2d')!;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, src.width, src.height, 0, 0, e.width, e.height);
  return e;
}

/** Önbellekteyse döndürür, yoksa null (eşzamanlı, çizim yolunda beklemez). */
export function deathSprite(kind: number): DeathSprite | null {
  return cache.get(kind) ?? null;
}

/** Lazy yükleme (tek uçuş): hazır olunca tekrar çizilir. Hata -> null. */
export function ensureDeathSprite(kind: number): Promise<DeathSprite | null> {
  const hit = cache.get(kind);
  if (hit) return Promise.resolve(hit);
  const on = inflight.get(kind);
  if (on) return on;
  const file = FILES[kind];
  if (!file) return Promise.resolve(null);
  const job = (async (): Promise<DeathSprite | null> => {
    try {
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}death-food/${file}.webp`;
      await img.decode();
      const full = document.createElement('canvas');
      full.width = 128;
      full.height = 128;
      const fx = full.getContext('2d')!;
      fx.imageSmoothingEnabled = true;
      fx.imageSmoothingQuality = 'high';
      fx.drawImage(img, 0, 0, 128, 128);
      const m64 = halve(full);
      const m32 = halve(m64);
      const m16 = halve(m32);
      const sp: DeathSprite = { kind, img: full, mips: [full, m64, m32, m16] };
      cache.set(kind, sp);
      return sp;
    } catch {
      return null;
    } finally {
      inflight.delete(kind);
    }
  })();
  inflight.set(kind, job);
  return job;
}

/** İstenen cihaz-px'i karşılayan en küçük mip (yetmezse 128). */
export function spriteMip(sp: DeathSprite, needPx: number): HTMLCanvasElement {
  const sizes = [16, 32, 64, 128];
  for (let i = 0; i < sizes.length; i++) {
    if (sizes[i] >= needPx) return sp.mips[3 - i];
  }
  return sp.mips[0];
}

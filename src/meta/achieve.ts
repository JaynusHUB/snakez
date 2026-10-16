// Başarımlar: tek dosyalık liste (kolay genişletilir). Saf veri + değerlendirme,
// DOM yok. Açılma SADECE mevcut verilerden hesaplanır (career sayaçları,
// oyun sayısı, seviye, koleksiyon); ödül yok, ekonomi etkilenmez.
import type { Rarity } from './catalog.ts';
import type { Career } from './career.ts';
import { saveCareer } from './career.ts';

export interface AchCtx {
  career: Career;
  /** Seviye (rütbe başarımları için). */
  level: number;
  /** Toplam oyun (snakez.games). */
  games: number;
  /** Sahip olunan / toplam skin. */
  skinsHave: number;
  skinsTotal: number;
}

export interface AchDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  /** SVG iç yüzü (24x24, currentColor; views tarafında sarılır). */
  icon: string;
  /** Hedef sayı (ilerleme çubuğu). */
  goal: number;
  /** Birim etiketi ("eleme", "sn", "sv", "%", "oyun", "gün"). */
  unit: string;
  /** Mevcut ilerleme. */
  get: (ctx: AchCtx) => number;
  /** Varsa çubuk altı metni bununla yazılır (sıralama gibi ters metrikler). */
  customProg?: (ctx: AchCtx) => string;
}

const SW = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

// ── İkonlar (kategori başına; ad metni kimliği taşır) ──
const IC = {
  drop: `<path d="M12 3c3 4.2 6 7.6 6 11a6 6 0 01-12 0c0-3.4 3-6.8 6-11z" ${SW}/>`,
  cross: `<circle cx="12" cy="12" r="7" ${SW}/><circle cx="12" cy="12" r="1.6" ${F}/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" ${SW}/>`,
  skull: `<path d="M12 3a7 7 0 00-7 7c0 2.4 1.1 4 2.8 5V19h8.4v-4c1.7-1 2.8-2.6 2.8-5a7 7 0 00-7-7z" ${SW}/><circle cx="9.5" cy="11" r="1.2" ${F}/><circle cx="14.5" cy="11" r="1.2" ${F}/>`,
  claw: `<path d="M4 5l7 14M10 5l7 14M16 5l4 8" ${SW}/>`,
  wind: `<path d="M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h8" ${SW}/>`,
  shield: `<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" ${SW}/>`,
  hour: `<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" ${SW}/>`,
  medal: `<circle cx="12" cy="14" r="5" ${SW}/><path d="M9 9L6 3h4l2 4 2-4h4l-3 6" ${SW}/>`,
  podium: `<path d="M3 20h18M6 20v-5h4v5M10 20V9h4v11M14 20v-7h4v7" ${SW}/>`,
  crown: `<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" ${F}/>`,
  flame: `<path d="M12 3s5 4.5 5 9.5a5 5 0 01-10 0c0-2 1-3.5 1-3.5S9 10 10 10c0-3 2-7 2-7z" ${SW}/>`,
  bolt: `<path d="M13 2L5 13.5h6L10 22l9-12.5h-6z" ${F}/>`,
  mount: `<path d="M3 20L10 8l4 6 3-4 4 10z" ${SW}/>`,
  play: `<rect x="4" y="4" width="16" height="16" rx="5" ${SW}/><path d="M10.5 9.5l4.5 2.5-4.5 2.5z" ${F}/>`,
  repeat: `<path d="M5 12a7 7 0 0112-4.9M19 12a7 7 0 01-12 4.9" ${SW}/><path d="M17 3v4h-4M7 21v-4h4" ${SW}/>`,
  layers: `<path d="M12 3l8 5-8 5-8-5z" ${SW}/><path d="M4 13l8 5 8-5" ${SW}/>`,
  chev: `<path d="M6 14l6-6 6 6" ${SW}/>`,
  chev2: `<path d="M6 11l6-6 6 6M6 17l6-6 6 6" ${SW}/>`,
  star: `<path d="M12 4l2.3 4.9 5.2.7-3.8 3.6.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z" ${SW}/>`,
  starc: `<circle cx="12" cy="12" r="8.5" ${SW}/><path d="M12 8l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" ${F}/>`,
  gem: `<path d="M7 4h10l3 5-8 11L4 9z" ${SW}/><path d="M4 9h16M12 20L9 9l3-5 3 5z" ${SW}/>`,
  sun: `<circle cx="12" cy="12" r="4" ${SW}/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" ${SW}/>`,
  cal: `<rect x="4" y="5" width="16" height="15" rx="2" ${SW}/><path d="M4 10h16M8 3v4M16 3v4" ${SW}/>`,
  calck: `<rect x="4" y="5" width="16" height="15" rx="2" ${SW}/><path d="M4 10h16M8 3v4M16 3v4M10 15l1.8 1.8L15 13.5" ${SW}/>`,
  grid: `<rect x="4" y="4" width="7" height="7" rx="1.5" ${SW}/><rect x="13" y="4" width="7" height="7" rx="1.5" ${SW}/><rect x="4" y="13" width="7" height="7" rx="1.5" ${SW}/><path d="M16.5 13v7M13 16.5h7" ${SW}/>`,
};

const rankProg = (n: number) => ({
  goal: 1,
  unit: '',
  get: (c: AchCtx): number => (c.career.bestRank > 0 && c.career.bestRank <= n ? 1 : 0),
  customProg: (c: AchCtx): string => (c.career.bestRank > 0 ? `en iyi #${c.career.bestRank}` : 'henüz yok'),
});

export const ACHIEVEMENTS: AchDef[] = [
  // ── ELEME ──
  { id: 'first-blood', name: 'İlk Kan', desc: 'İlk elemeni yap', rarity: 'nadir', icon: IC.drop, goal: 1, unit: 'eleme', get: (c) => c.career.kills },
  { id: 'hunter', name: 'Avcı', desc: 'Toplam 50 eleme', rarity: 'nadir', icon: IC.cross, goal: 50, unit: 'eleme', get: (c) => c.career.kills },
  { id: 'killer', name: 'Katil', desc: 'Toplam 250 eleme', rarity: 'epik', icon: IC.skull, goal: 250, unit: 'eleme', get: (c) => c.career.kills },
  { id: 'predator', name: 'Yırtıcı', desc: 'Toplam 1000 eleme', rarity: 'efsane', icon: IC.claw, goal: 1000, unit: 'eleme', get: (c) => c.career.kills },
  // ── HAYATTA KALMA (tek oyun) ──
  { id: 'breathe', name: 'Nefes Al', desc: 'Tek oyunda 1 dakika yaşa', rarity: 'nadir', icon: IC.wind, goal: 60, unit: 'sn', get: (c) => c.career.longest },
  { id: 'durable', name: 'Dayanıklı', desc: 'Tek oyunda 5 dakika yaşa', rarity: 'epik', icon: IC.shield, goal: 300, unit: 'sn', get: (c) => c.career.longest },
  { id: 'immortal', name: 'Ölümsüz', desc: 'Tek oyunda 10 dakika yaşa', rarity: 'efsane', icon: IC.hour, goal: 600, unit: 'sn', get: (c) => c.career.longest },
  // ── SIRALAMA (en iyi sıra) ──
  { id: 'top10', name: 'İlk 10', desc: 'En iyi sıran ilk 10 olsun', rarity: 'nadir', icon: IC.medal, ...rankProg(10) },
  { id: 'podium', name: 'Podyum', desc: 'En iyi sıran ilk 3 olsun', rarity: 'epik', icon: IC.podium, ...rankProg(3) },
  { id: 'king', name: 'Arenanın Kralı', desc: 'Arenanın zirvesine çık (#1)', rarity: 'efsane', icon: IC.crown, ...rankProg(1) },
  // ── SKOR (tek oyun) ──
  { id: 'warmup', name: 'Isınma', desc: 'Tek oyunda 500 skor', rarity: 'nadir', icon: IC.flame, goal: 500, unit: 'skor', get: (c) => c.career.bestScore },
  { id: 'strong', name: 'Güçlü', desc: 'Tek oyunda 2.000 skor', rarity: 'epik', icon: IC.bolt, goal: 2000, unit: 'skor', get: (c) => c.career.bestScore },
  { id: 'giant', name: 'Dev', desc: 'Tek oyunda 5.000 skor', rarity: 'efsane', icon: IC.mount, goal: 5000, unit: 'skor', get: (c) => c.career.bestScore },
  // ── OYUN SAYISI ──
  { id: 'regular', name: 'Alıştın', desc: '25 oyun oyna', rarity: 'nadir', icon: IC.play, goal: 25, unit: 'oyun', get: (c) => c.games },
  { id: 'addict', name: 'Bağımlı', desc: '100 oyun oyna', rarity: 'epik', icon: IC.repeat, goal: 100, unit: 'oyun', get: (c) => c.games },
  { id: 'stubborn', name: 'Vazgeçmez', desc: '500 oyun oyna', rarity: 'efsane', icon: IC.layers, goal: 500, unit: 'oyun', get: (c) => c.games },
  // ── SEVİYE (nadirdan efsaneviye dereceli) ──
  { id: 'lv10', name: 'Avcı rütbesi', desc: '10. seviyeye ulaş', rarity: 'nadir', icon: IC.chev, goal: 10, unit: 'sv', get: (c) => c.level },
  { id: 'lv30', name: 'Gölge rütbesi', desc: '30. seviyeye ulaş', rarity: 'nadir', icon: IC.chev2, goal: 30, unit: 'sv', get: (c) => c.level },
  { id: 'lv60', name: 'Usta rütbesi', desc: '60. seviyeye ulaş', rarity: 'epik', icon: IC.star, goal: 60, unit: 'sv', get: (c) => c.level },
  { id: 'lv100', name: 'Efsane rütbesi', desc: '100. seviyeye ulaş', rarity: 'epik', icon: IC.starc, goal: 100, unit: 'sv', get: (c) => c.level },
  { id: 'lv200', name: 'Titan', desc: '200. seviyeye ulaş', rarity: 'efsane', icon: IC.crown, goal: 200, unit: 'sv', get: (c) => c.level },
  { id: 'lv350', name: 'Mitik', desc: '350. seviyeye ulaş', rarity: 'efsane', icon: IC.gem, goal: 350, unit: 'sv', get: (c) => c.level },
  { id: 'lv500', name: 'Snakez Tanrısı', desc: '500. seviyeye ulaş', rarity: 'efsane', icon: IC.sun, goal: 500, unit: 'sv', get: (c) => c.level },
  // ── SERİ (yerel gün) ──
  { id: 'streak3', name: '3 Gün Üst Üste', desc: '3 gün üst üste oyna', rarity: 'epik', icon: IC.cal, goal: 3, unit: 'gün', get: (c) => c.career.streak },
  { id: 'streak7', name: '7 Gün Üst Üste', desc: '7 gün üst üste oyna', rarity: 'efsane', icon: IC.calck, goal: 7, unit: 'gün', get: (c) => c.career.streak },
  // ── KOLEKSİYON ──
  { id: 'collector', name: 'Koleksiyoncu', desc: "Skinlerin %50'sine sahip ol", rarity: 'epik', icon: IC.grid, goal: 100, unit: '%', get: (c) => (c.skinsTotal > 0 ? Math.floor((c.skinsHave / c.skinsTotal) * 100) : 0) },
];

/** Toplam başarım sayısı (özet satırı buradan beslenir, elle yazılmaz). */
export const ACH_TOTAL = ACHIEVEMENTS.length;

/**
 * Kariyerdeki eksik başarımları değerlendirir, açılanları kalıcı yazar.
 * Dönen: bu çağrıda YENİ açılan id'ler. Bir kez açılan geri kapanmaz.
 */
export function evalAchievements(ctx: AchCtx): string[] {
  const fresh: string[] = [];
  const now = Date.now();
  for (const d of ACHIEVEMENTS) {
    if (ctx.career.ach[d.id]) continue;
    let cur = 0;
    try {
      cur = d.get(ctx);
    } catch {
      cur = 0;
    }
    if (Number.isFinite(cur) && cur >= d.goal) {
      ctx.career.ach[d.id] = now;
      fresh.push(d.id);
    }
  }
  if (fresh.length) saveCareer(ctx.career);
  return fresh;
}

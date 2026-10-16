// Günlük sandık: saf mantık (DOM yok). Durum okuma/yazma + ödül çekilişi.
// Ödül uygulama (coin/ownership/equip) meta.ts'te — kayıt tek elde kalır.
//
// Ekonomi guardı: coin küçük (25-60 + streak bonusu), kozmetik yalnızca
// nadir + ucuz epik (≤600); efsanevi sandıktan ÇIKMAZ, yoksa market ölür.
// Uygun kozmetik kalmamışsa teselli coin (80).
import { SHOP_FRAMES, SHOP_FX, SHOP_NAMES, SHOP_SKINS, allKeys, basePrice, nameOf } from './catalog.ts';

const KEY = 'snakez.chest';

interface ChestState {
  last: string;
  streak: number;
  /** Şanslı sandık hakkı (100 coin ile alınır, tek kullanımlık). */
  extra: boolean;
}

interface ChestReward {
  kind: 'coins' | 'cosmetic';
  /** Coin ödülünde miktar (teselli dahil). */
  coins: number;
  /** Kozmetikte 'skin:id' | 'fx:id' | 'name:id' | 'frame:id' (coin'de ''). */
  key: string;
  label: string;
  color: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');
/** Gece yarısına kalan süreyi kısa metne çevirir ("7 sa 12 dk"). */
export function countdown(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} sa ${m % 60} dk` : `${m} dk`;
}
/** Yerel gün dizesi: günlük sınır sunucusuz böyle tutulur (dealKey ile aynı fikir). */
export const dayStr = (d = new Date()): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 86400000 çıkarmak DST günlerinde (23/25 saat) yanlış güne düşer. Takvimden git.
const prevDay = (d = new Date()): string => {
  const p = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return dayStr(p);
};

function blank(): ChestState {
  return { last: '', streak: 0, extra: false };
}

export function loadChest(): ChestState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<ChestState>;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return blank();
    const streak = typeof raw.streak === 'number' && Number.isFinite(raw.streak) && raw.streak > 0 ? Math.floor(raw.streak) : 0;
    const last = typeof raw.last === 'string' ? raw.last : '';
    return { last, streak, extra: raw.extra === true };
  } catch {
    return blank();
  }
}

function store(s: ChestState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* gizli mod — sandık yine açılır, kayıt yapılmaz */
  }
}

/** Sandık açılabilir mi? + gece yarısına kalan süre (ms) + mevcut seri. */
export function chestStatus(now = new Date()): { ready: boolean; msLeft: number; streak: number; extra: boolean } {
  const s = loadChest();
  const today = dayStr(now);
  if (s.last === today && !s.extra) {
    const mid = new Date(now);
    mid.setHours(24, 0, 0, 0);
    return { ready: false, msLeft: mid.getTime() - now.getTime(), streak: s.streak, extra: false };
  }
  return { ready: true, msLeft: 0, streak: s.last === prevDay(now) ? s.streak : 0, extra: s.last === today && s.extra };
}

/** Sandık kozmetik havuzu: sahip olunmayan + nadir/ucuz-epik anahtarlar. */
export function chestPool(own: string[]): string[] {
  return [...nadirPool(own), ...epikPool(own)];
}

/** Nadir havuzu (özel ürünler dahil): sahip olunmayan + nadir/ucuz anahtarlar. */
export function nadirPool(own: string[]): string[] {
  const has = new Set(own);
  const ok: string[] = [];
  for (const s of SHOP_SKINS) if (s.rarity === 'nadir' && !has.has('skin:' + s.id)) ok.push('skin:' + s.id);
  for (const f of SHOP_FX) if (f.rarity === 'nadir' && !has.has('fx:' + f.id)) ok.push('fx:' + f.id);
  for (const n of SHOP_NAMES) if (n.rarity === 'nadir' && !has.has('name:' + n.id)) ok.push('name:' + n.id);
  for (const f of SHOP_FRAMES) if (f.rarity === 'nadir' && !has.has('frame:' + f.id)) ok.push('frame:' + f.id);
  // allKeys() ile kesişim güvencesi: katalog dışı anahtar havuza giremez.
  const valid = new Set(allKeys());
  return ok.filter((k) => valid.has(k) && basePrice(k) > 0);
}

/** Epik havuzu: sahip olunmayan + ucuz (≤600) epikler. Efsanevi çıkmaz. */
export function epikPool(own: string[]): string[] {
  const has = new Set(own);
  const cheap = (price: number): boolean => price <= 600;
  const ok: string[] = [];
  for (const f of SHOP_FX) if (f.rarity === 'epik' && cheap(f.price) && !has.has('fx:' + f.id)) ok.push('fx:' + f.id);
  for (const n of SHOP_NAMES) if (n.rarity === 'epik' && cheap(n.price) && !has.has('name:' + n.id)) ok.push('name:' + n.id);
  for (const f of SHOP_FRAMES) if (f.rarity === 'epik' && cheap(f.price) && !has.has('frame:' + f.id)) ok.push('frame:' + f.id);
  const valid = new Set(allKeys());
  return ok.filter((k) => valid.has(k) && basePrice(k) > 0);
}

const cosmeticColor = (key: string): string => {
  const [k, id] = key.split(':');
  if (k === 'skin') return SHOP_SKINS.find((x) => x.id === id)?.color ?? '#fff';
  if (k === 'fx') return SHOP_FX.find((x) => x.id === id)?.color ?? '#fff';
  if (k === 'name') return SHOP_NAMES.find((x) => x.id === id)?.color ?? '#fff';
  return SHOP_FRAMES.find((x) => x.id === id)?.color ?? '#fff';
};

/** Özel ağırlıklı ürünler (% puan): nadir payının içinden çekilir. */
export const SPECIAL_W: Record<string, number> = { 'name:cyan': 0.5, 'name:lime': 5, 'frame:neon': 3 };
/** Tabloda gösterilen özel şans metinleri. */
export const SPECIAL_SHARE: Record<string, string> = { 'name:cyan': '%0,5', 'name:lime': '%5', 'frame:neon': '%3' };
const NADIR_SHARE = 22;
const EPIK_SHARE = 6;

const trNum = (n: number): string => n.toLocaleString('tr-TR');

/**
 * Ödülü belirler + sandık durumunu GÜNCELLER (önce kaydet: modal kapanırsa
 * bile ödül kaybolmaz; uygulama meta.ts'te yapılır). Dönen streak yeni seridir.
 *
 * Paylar (% puan, toplam 100): coin 62 (25-60+bonus) + büyük coin 10
 * (1000-10000) + nadir 22 + epik 6. Nadirin içinden özel ürünler kendi
 * ağırlığıyla çıkar; sahip olunan özel ürünün payı diğer nadirlere kayar
 * (nadir toplamı hep %22). Havuzlar boşsa 80 teselli coin.
 * Şanslı hakta (extra) seri artmaz, şans aynıdır.
 */
export function claimChest(own: string[], now = new Date()): { reward: ChestReward; streak: number } {
  const s = loadChest();
  const today = dayStr(now);
  const isExtra = s.last === today && s.extra;
  const streak = isExtra ? s.streak : s.last === prevDay(now) ? s.streak + 1 : 1;
  store({ last: today, streak, extra: false });
  const r = Math.random() * 100;
  if (r < 62) {
    const coins = 25 + ((Math.random() * 36) | 0) + Math.min(streak - 1, 5) * 5;
    return { reward: { kind: 'coins', coins, key: '', label: `${trNum(coins)} Coin`, color: '#ffd35c' }, streak };
  }
  if (r < 72) {
    const coins = 1000 + ((Math.random() * 9001) | 0);
    return { reward: { kind: 'coins', coins, key: '', label: `${trNum(coins)} Coin`, color: '#ffd35c' }, streak };
  }
  const epik = epikPool(own);
  if (r < 72 + EPIK_SHARE) {
    if (epik.length) {
      const key = epik[(Math.random() * epik.length) | 0];
      return { reward: { kind: 'cosmetic', coins: 0, key, label: nameOf(key), color: cosmeticColor(key) }, streak };
    }
    return { reward: { kind: 'coins', coins: 80, key: '', label: '80 Coin', color: '#ffd35c' }, streak };
  }
  // Nadir dalı (%22): önce sahip olunmayan özel ürünler, kalan pay diğer nadirlere.
  const allNadir = nadirPool(own);
  const rest = allNadir.filter((k) => !(k in SPECIAL_W));
  const avail = Object.keys(SPECIAL_W).filter((k) => allNadir.includes(k));
  const wSum = avail.reduce((a, k) => a + SPECIAL_W[k], 0);
  const sub = Math.random() * NADIR_SHARE;
  let acc = 0;
  for (const k of avail) {
    acc += SPECIAL_W[k];
    if (sub < acc) {
      return { reward: { kind: 'cosmetic', coins: 0, key: k, label: nameOf(k), color: cosmeticColor(k) }, streak };
    }
  }
  const restShare = NADIR_SHARE - wSum;
  if (rest.length && restShare > 0) {
    const key = rest[Math.min(rest.length - 1, ((sub - wSum) / restShare) * rest.length) | 0];
    return { reward: { kind: 'cosmetic', coins: 0, key, label: nameOf(key), color: cosmeticColor(key) }, streak };
  }
  return { reward: { kind: 'coins', coins: 80, key: '', label: '80 Coin', color: '#ffd35c' }, streak };
}

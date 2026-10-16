// Market kataloğu: saf veri (DOM yok). Fiyatları/ürünleri buradan değiştir.
import type { FxCfg } from '../systems/SkinFx.ts';

export type Rarity = 'nadir' | 'epik' | 'efsane';
export const RARITY: Record<Rarity, { label: string; color: string }> = {
  nadir: { label: 'NADİR', color: '#4ee063' },
  epik: { label: 'EPİK', color: '#b46bff' },
  efsane: { label: 'EFSANEVİ', color: '#ffb02e' },
};

/** idx = SKIN_DEFS içindeki sıra (15–22: sprite skinler). id = sprite kimliği. */
export interface ShopSkin { id: string; idx: number; name: string; price: number; rarity: Rarity; tag: string; color: string }
export const SHOP_SKINS: ShopSkin[] = [
  { id: 'krampus', color: '#f3efe2', idx: 15, name: 'Krampus', price: 400, rarity: 'nadir', tag: 'Karlı buz kristalleri' },
  { id: 'werewolf', color: '#ff3a2a', idx: 17, name: 'Kurt', price: 600, rarity: 'nadir', tag: 'Yükselen kor ve kıvılcım' },
  { id: 'redwolf', color: '#ff3b30', idx: 19, name: 'Red Wolf', price: 700, rarity: 'epik', tag: 'Kızıl gözlü avcı' },
  { id: 'cygnus', color: '#9b5cff', idx: 16, name: 'Cygnus', price: 800, rarity: 'epik', tag: 'Mor yıldız tozu' },
  { id: 'xen', color: '#a855f7', idx: 18, name: 'Purple XEN', price: 1000, rarity: 'epik', tag: 'Uzaylı neon parıltı' },
  { id: 'pinkdragon', color: '#ff4da6', idx: 20, name: 'Pink Dragon', price: 1500, rarity: 'efsane', tag: 'Pembe alev ejderhası' },
  { id: 'greendragon', color: '#4dff6a', idx: 21, name: 'Green Dragon', price: 1500, rarity: 'efsane', tag: 'Zümrüt ejderha' },
  { id: 'bluedragon', color: '#3fa7ff', idx: 22, name: 'Blue Dragon', price: 1500, rarity: 'efsane', tag: 'Buz mavisi ejderha' },
];

export interface ShopFx { id: string; name: string; desc: string; price: number; rarity: Rarity; color: string; cfg: FxCfg }
const base = { boostMul: 2, spread: 0.35, bodyBias: 1, tailShare: 0.2, shrink: false } as const;
export const SHOP_FX: ShopFx[] = [
  { id: 'sparkle', name: 'Yıldız Tozu', desc: 'Altın yıldızlar saçılır', price: 250, rarity: 'nadir', color: '#ffe14a',
    cfg: { ...base, colors: ['#ffe14a', '#fff3a0', '#ffffff'], sparkChance: 0.7, rate: 0.2, life: [0.7, 1.4], size: [0.3, 0.7], rise: 0.25, twinkle: true } },
  { id: 'ember', name: 'Köz', desc: 'Yükselen kızıl kıvılcımlar', price: 300, rarity: 'nadir', color: '#ff7a1a',
    cfg: { ...base, colors: ['#ff3b30', '#ff7a1a', '#ffc14a'], sparkChance: 0.15, rate: 0.26, life: [0.55, 1.2], size: [0.3, 0.7], rise: 0.8, twinkle: false, shrink: true,
      headGlow: { color: '#ff2a1a', forward: 0.35, size: 1.5, pulse: 0.2, alpha: 0.26 } } },
  { id: 'frost', name: 'Buz Kristali', desc: 'Süzülen buz parçacıkları', price: 300, rarity: 'nadir', color: '#8fd3ff',
    cfg: { ...base, colors: ['#bfe9ff', '#8fd3ff', '#ffffff'], sparkChance: 0.35, rate: 0.16, life: [0.8, 1.5], size: [0.22, 0.5], rise: -0.4, twinkle: true } },
  { id: 'toxic', name: 'Zehir Sporu', desc: 'Parlayan yeşil sporlar', price: 450, rarity: 'epik', color: '#7dff4d',
    cfg: { ...base, colors: ['#4dff6a', '#b6ff4d', '#eaffea'], sparkChance: 0.2, rate: 0.22, life: [0.8, 1.6], size: [0.3, 0.8], rise: 0.35, twinkle: true,
      headGlow: { color: '#4dff6a', forward: 0.4, size: 1.4, pulse: 0.12, alpha: 0.22 } } },
  { id: 'neon', name: 'Neon İz', desc: 'Cyan-mor neon parıltı', price: 600, rarity: 'epik', color: '#2be7ff',
    cfg: { ...base, colors: ['#2be7ff', '#9d5cff', '#ff5cf0'], tailColors: ['#2be7ff', '#9d5cff'], sparkChance: 0.6, rate: 0.26, life: [0.7, 1.4], size: [0.4, 0.9], rise: 0.2, twinkle: true,
      headGlow: { color: '#2be7ff', forward: 0.4, size: 1.5, pulse: 0.14, alpha: 0.24 } } },
  { id: 'galaxy', name: 'Galaksi', desc: 'Çok renkli yıldız yağmuru', price: 1000, rarity: 'efsane', color: '#ff5cf0',
    cfg: { ...base, boostMul: 2.4, colors: ['#ff5cf0', '#2be7ff', '#ffe14a', '#a8ff3e', '#9d5cff'], sparkChance: 0.8, rate: 0.34, life: [0.8, 1.6], size: [0.4, 1], rise: 0.3, spread: 0.5, twinkle: true,
      headGlow: { color: '#ffffff', forward: 0.4, size: 1.6, pulse: 0.16, alpha: 0.24 } } },
];
export const fxById = (id: string): ShopFx | undefined => SHOP_FX.find((f) => f.id === id);
export const skinByIdx = (idx: number): ShopSkin | undefined => SHOP_SKINS.find((s) => s.idx === idx);

// ── Profil ürünleri: isim rengi + rozet çerçevesi ───────────────────────────
export interface ShopLook { id: string; name: string; price: number; rarity: Rarity; color: string; tag: string }
export const SHOP_NAMES: ShopLook[] = [
  { id: 'cyan', name: 'Neon Cyan', price: 150, rarity: 'nadir', color: '#2be7ff', tag: 'Soğuk neon parıltı' },
  { id: 'lime', name: 'Asit Yeşili', price: 150, rarity: 'nadir', color: '#a8ff3e', tag: 'Göz alan yeşil' },
  { id: 'pink', name: 'Şeker Pembe', price: 250, rarity: 'epik', color: '#ff5cf0', tag: 'Canlı pembe' },
  { id: 'gold', name: 'Altın', price: 400, rarity: 'epik', color: '#ffd35c', tag: 'Liderlerin rengi' },
  { id: 'rainbow', name: 'Gökkuşağı', price: 800, rarity: 'efsane', color: '#ff5cf0', tag: 'Akan renk geçişi' },
  { id: 'inferno', name: 'Cehennem Alevi', price: 1000, rarity: 'efsane', color: '#ff7a1a', tag: 'Alev gibi yanan, kıvılcım saçan isim' },
];
export const SHOP_FRAMES: ShopLook[] = [
  { id: 'neon', name: 'Neon Halka', price: 300, rarity: 'nadir', color: '#2be7ff', tag: 'Dönen neon ışık yayları' },
  { id: 'gold', name: 'Altın Çerçeve', price: 500, rarity: 'epik', color: '#ffd35c', tag: 'Parlak altın kenar' },
  { id: 'orbit', name: 'Yörünge', price: 700, rarity: 'epik', color: '#9d5cff', tag: 'Kuyruklu gezegenler çevrende döner' },
  { id: 'aurora', name: 'Aurora', price: 1200, rarity: 'efsane', color: '#a8ff3e', tag: 'Kayan kutup ışığı' },
  { id: 'prism', name: 'Prizma', price: 1600, rarity: 'efsane', color: '#ff5cf0', tag: 'Dönen holografik ışık ve parıltı' },
  { id: 'snake', name: 'Yılan Pulu', price: 400, rarity: 'nadir', color: '#4ee063', tag: 'Pullu deri ve çevrende dolanan yılan' },
  { id: 'ice', name: 'Buz Zırhı', price: 900, rarity: 'epik', color: '#8fd3ff', tag: 'Dönen buz kristalleri ve soğuk parıltı' },
  { id: 'magma', name: 'Magma', price: 1400, rarity: 'efsane', color: '#ff6a1a', tag: 'Çatlaklarından lav akan, köz saçan çerçeve' },
];
export const lookById = (list: ShopLook[], id: string): ShopLook | undefined => list.find((x) => x.id === id);

// ── Günün Fırsatı: tarihe göre dönen %30 indirim (sunucu gerekmez) ─────────────
export const DEAL_PCT = 30;
export function allKeys(): string[] {
  return [...SHOP_SKINS.map((s) => 'skin:' + s.id), ...SHOP_FX.map((f) => 'fx:' + f.id),
    ...SHOP_NAMES.map((n) => 'name:' + n.id), ...SHOP_FRAMES.map((f) => 'frame:' + f.id)];
}
export function dealKey(d = new Date()): string {
  const k = allKeys(), n = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return k[(n * 7 + 3) % k.length];
}
export const priceFor = (key: string, base: number, deal: string): number =>
  key === deal ? Math.round(base * (100 - DEAL_PCT) / 100) : base;
export function msToMidnight(d = new Date()): number {
  const n = new Date(d); n.setHours(24, 0, 0, 0); return n.getTime() - d.getTime();
}
export function basePrice(key: string): number {
  const [k, id] = key.split(':');
  return (k === 'skin' ? SHOP_SKINS.find((x) => x.id === id)?.price
    : k === 'fx' ? fxById(id)?.price
    : k === 'name' ? lookById(SHOP_NAMES, id)?.price
    : lookById(SHOP_FRAMES, id)?.price) ?? 0;
}
export function nameOf(key: string): string {
  const [k, id] = key.split(':');
  return (k === 'skin' ? SHOP_SKINS.find((x) => x.id === id)?.name
    : k === 'fx' ? fxById(id)?.name
    : k === 'name' ? lookById(SHOP_NAMES, id)?.name
    : lookById(SHOP_FRAMES, id)?.name) ?? key;
}
/** Sandık ödül kademesi: '' (coin) → 'coin', yoksa ürün rarity'si. */
export function rarityOf(key: string): 'coin' | Rarity {
  if (!key) return 'coin';
  const [k, id] = key.split(':');
  const r = k === 'skin' ? SHOP_SKINS.find((x) => x.id === id)?.rarity
    : k === 'fx' ? fxById(id)?.rarity
    : k === 'name' ? lookById(SHOP_NAMES, id)?.rarity
    : lookById(SHOP_FRAMES, id)?.rarity;
  return r ?? 'nadir';
}

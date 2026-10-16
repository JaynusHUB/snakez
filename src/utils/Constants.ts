// Harita yarıçapı (WR) + normal yem stoğu (FOOD_N). Yoğunluk sabit:
// FOOD_N = 5200 * (5250/4200)^2 = 8125. Boyutu sonradan ayarlamak için
// SADECE bu iki değeri oranlı değiştir (FOOD_RATE refill hızıdır, stoğa
// değil tüketime bakar — dokunma).
export const WR = 5250;
export const FOOD_N = 8125;
export const FOOD_RATE = 26;
export const BOTS = 30;
export const V_NORM = 185;
export const V_BOOST = 400;
export const BOT_GAIN = 0.7;
export const MIN_BOOST = 11;
export const SC = 128;
export const FC = 200;

export interface SkinDef {
  n: string;
  c: string[];
  b: number;
  sprite?: string;
}

export const SKIN_DEFS: SkinDef[] = [
  { n: 'Lavanta', c: ['#a9a8ff'], b: 1 },
  { n: 'Mavi', c: ['#3f7bff'], b: 1 },
  { n: 'Turkuaz', c: ['#2fd6d3'], b: 1 },
  { n: 'Yeşil', c: ['#4ee063'], b: 1 },
  { n: 'Sarı', c: ['#f6dc3a'], b: 1 },
  { n: 'Turuncu', c: ['#ff8f2e'], b: 1 },
  { n: 'Kırmızı', c: ['#ee3b3b'], b: 1 },
  { n: 'Pembe', c: ['#ff6fb5'], b: 1 },
  { n: 'Mor', c: ['#a75cf0'], b: 1 },
  { n: 'Gökkuşağı', c: ['#ff4d4d', '#ff9f2e', '#ffe14a', '#4dff6a', '#3fa7ff', '#b46bff'], b: 4 },
  { n: 'Şeker', c: ['#ffffff', '#ff4d8d'], b: 5 },
  { n: 'Zebra', c: ['#f4f4f4', '#1b1e26'], b: 5 },
  { n: 'Buz', c: ['#9fe8ff', '#e8fbff', '#5fb4ff'], b: 5 },
  { n: 'Bayrak', c: ['#e30a17', '#e30a17', '#e30a17', '#ffffff'], b: 4 },
  { n: 'Yıldızlı', c: ['#2f55e0', '#2f55e0', '#2f55e0', '#e83a3a', '#2f55e0', '#f2a646', '#2f55e0', '#e8dc4a', '#2f55e0', '#ffffff'], b: 3 },
  { n: 'Krampus', c: ['#f3efe2'], b: 1, sprite: 'krampus' },
  { n: 'Cygnus', c: ['#9b5cff'], b: 1, sprite: 'cygnus' },
  { n: 'Kurt', c: ['#ff3a2a'], b: 1, sprite: 'werewolf' },
  { n: 'Purple XEN', c: ['#a855f7'], b: 1, sprite: 'xen' },
  { n: 'Red Wolf', c: ['#ff3b30'], b: 1, sprite: 'redwolf' },
  { n: 'Pink Dragon', c: ['#ff4da6'], b: 1, sprite: 'pinkdragon' },
  { n: 'Green Dragon', c: ['#4dff6a'], b: 1, sprite: 'greendragon' },
  { n: 'Blue Dragon', c: ['#3fa7ff'], b: 1, sprite: 'bluedragon' },
];

export const NAMES = ['Kobra','Boa','Engerek','Piton','Zehir','Şimşek','Gölge','Pars','Tufan','Yıldız','Ejder','Kral','Roket','Deniz','Fırtına','Nokta','Ateş','Kurt','Sessiz','Aslan','Bulut','Çılgın','Fatih','Ceylan','Tosun','Sultan','Efe','Zeynep','Mert','Bora','Karaca','Poyraz','Tilki','Şahin','Bozkurt','Avcı','Duman','Yılancık','Çelik','Rüzgar'];

export const PAL = ['#8b8fe8','#e6d63c','#e83a3a','#3dd6c8','#ff8f2e','#b25ce0','#e0329f','#52d966','#5aa0ff','#eeeeee'];

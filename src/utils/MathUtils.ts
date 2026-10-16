export const TAU = Math.PI * 2;

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export function angDiff(a: number, b: number): number {
  const d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

export const radiusOf = (m: number): number => 9 + 6 * Math.log10(1 + m / 40);

export const lengthOf = (m: number): number => 55 + 10.5 * Math.pow(m, 0.7);

export const pelR = (v: number): number => 2.6 + 1.5 * Math.sqrt(v);

export const cellOf = (v: number, s: number): number => clamp(Math.floor(v / s), -63, 63);

export const ckey = (ix: number, iy: number): number => (ix + 64) * 128 + (iy + 64);

function hex2rgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(c: string, t: [number, number, number], w: number): string {
  const a = hex2rgb(c);
  const r = a.map((v, i) => Math.round(v + (t[i] - v) * w));
  return 'rgb(' + r.join(',') + ')';
}

export function rgba(c: string, a: number): string {
  const r = hex2rgb(c);
  return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + a + ')';
}

export function skinIndex(colors: number, band: number, i: number): number {
  if (colors <= 1) return 0;
  return Math.floor(i / band) % colors;
}

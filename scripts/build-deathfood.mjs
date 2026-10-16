// Tek seferlik üretim: assets-src/death-food/*.png -> public/death-food/*.webp
// Kırp + ortala + normalize + defringe; 128px kutu, WebP ~15KB altı.
// Çalıştırma: node scripts/build-deathfood.mjs (idempotent).
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const FILES = [
  ['Blue_Dragon.png', 'bluedragon'],
  ['Cygnus.png', 'cygnus'],
  ['Green_Dragon.png', 'greendragon'],
  ['Krampus.png', 'krampus'],
  ['Kurt.png', 'werewolf'],
  ['Pink_Dragon.png', 'pinkdragon'],
  ['Purple_XEN.png', 'xen'],
  ['Red_Wolf.png', 'redwolf'],
];
const BOX = 128;
const DIAG_FIT = 116;

await mkdir('public/death-food', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent('<canvas id="c"></canvas>');

// 1. Oku + bbox + alfa sayımı (ölçekten önce).
const raws = [];
for (const [file, id] of FILES) {
  const buf = await readFile(`assets-src/death-food/${file}`);
  const info = await p.evaluate(async ({ b64 }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.getElementById('c');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1, n = 0, sx = 0, sy = 0, sa = 0;
    for (let j = 0; j < c.height; j++) {
      for (let i = 0; i < c.width; i++) {
        const a = d.data[(j * c.width + i) * 4 + 3];
        if (a > 8) {
          if (i < x0) x0 = i;
          if (j < y0) y0 = j;
          if (i > x1) x1 = i;
          if (j > y1) y1 = j;
          n++;
          sx += i * a;
          sy += j * a;
          sa += a;
        }
      }
    }
    return { w: c.width, h: c.height, x0, y0, x1, y1, n, cx: sx / Math.max(1, sa), cy: sy / Math.max(1, sa) };
  }, { b64: buf.toString('base64') });
  raws.push({ file, id, buf, ...info });
  console.log(`${id}: ${info.w}x${info.h} bbox=${info.x1 - info.x0 + 1}x${info.y1 - info.y0 + 1} alfa=${info.n}`);
}
// 2. Normalize: görünür kütle (sqrt alfa) eşitlensin.
const mean = raws.reduce((a, r) => a + Math.sqrt(r.n), 0) / raws.length;
let total = 0;
for (const r of raws) {
  const norm = mean / Math.sqrt(r.n);
  const bw = r.x1 - r.x0 + 1;
  const bh = r.y1 - r.y0 + 1;
  const diag = Math.hypot(bw, bh) * norm;
  const fit = Math.min(1, DIAG_FIT / diag);
  const scale = norm * fit;
  const out = await p.evaluate(async ({ b64, r, scale }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    // Kaynak kırpma.
    const cw = r.x1 - r.x0 + 1;
    const ch = r.y1 - r.y0 + 1;
    const src = document.createElement('canvas');
    src.width = cw;
    src.height = ch;
    const sx = src.getContext('2d', { willReadFrequently: true });
    sx.drawImage(img, r.x0, r.y0, cw, ch, 0, 0, cw, ch);
    // Defringe: yarı şeffaf piksele 3px içindeki en yakın opak komşunun rengi.
    const d = sx.getImageData(0, 0, cw, ch);
    const px = d.data;
    const at = (i, j) => (j >= 0 && j < ch && i >= 0 && i < cw ? px[(j * cw + i) * 4 + 3] : 0);
    const col = (i, j, k) => px[(j * cw + i) * 4 + k];
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const o = (j * cw + i) * 4;
        const a = px[o + 3];
        if (a > 0 && a < 250) {
          let best = -1, bd = 99;
          for (let dj = -3; dj <= 3 && bd > 1; dj++) {
            for (let di = -3; di <= 3; di++) {
              if (at(i + di, j + dj) >= 200) {
                const dd = Math.abs(di) + Math.abs(dj);
                if (dd < bd) { bd = dd; best = ((j + dj) * cw + (i + di)) * 4; }
              }
            }
          }
          if (best >= 0) { px[o] = px[best]; px[o + 1] = px[best + 1]; px[o + 2] = px[best + 2]; }
        }
      }
    }
    sx.putImageData(d, 0, 0);
    // Hedef: 128 kutu, ağırlık merkezi ortada, köşegen sığar.
    const S = 128;
    const out = document.createElement('canvas');
    out.width = S;
    out.height = S;
    const ox = out.getContext('2d');
    const dw = cw * scale;
    const dh = ch * scale;
    // Kırpma kutusundaki ağırlık merkezi -> kutu merkezi.
    const ccx = (r.cx - r.x0) * scale;
    const ccy = (r.cy - r.y0) * scale;
    ox.drawImage(src, 0, 0, cw, ch, S / 2 - ccx, S / 2 - ccy, dw, dh);
    for (const q of [0.85, 0.8, 0.7]) {
      const url = out.toDataURL('image/webp', q);
      const bytes = Math.round((url.length * 3) / 4);
      if (bytes < 15360 || q === 0.7) return { url, bytes, q, scale };
    }
  }, { b64: r.buf.toString('base64'), r: { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, cx: r.cx, cy: r.cy }, scale });
  const bytes = Buffer.from(out.url.split(',')[1], 'base64');
  await writeFile(`public/death-food/${r.id}.webp`, bytes);
  total += out.bytes;
  console.log(`  -> public/death-food/${r.id}.webp ${(out.bytes / 1024).toFixed(1)}KB q=${out.q} olcek=${out.scale.toFixed(2)}`);
}
console.log(`TOPLAM ${(total / 1024).toFixed(1)}KB (sinir 150KB)`);
await b.close();

import { chromium } from 'playwright';

const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;

const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

const p = await b.newPage({ viewport: { width: 1920, height: 950 }, reducedMotion: 'reduce' });
await p.goto('http://localhost:5173', { waitUntil: 'load' });
await sleep(3500);

// Yilani dondur ki iki ekran goruntusu ayni arka plana sahip olsun
await p.locator('.mn-chip').nth(0).hover();
await sleep(900);

const box = await p.locator('.mn-board').boundingBox();
const shot = () => p.locator('.mn-board').screenshot();

// Renkler STIL ENJEKSİYONUNDAN ÖNCE okunur: `getComputedStyle` enjekte
// edilmiş `color: transparent` kuralını görürse tüm ölçüm çöp olur
// (ilk denemede tam olarak bu oldu — 14/14 "rgba(0,0,0,0)" döndü).
const texts = await p.evaluate(() => {
  const out = [];
  const bd = document.querySelector('.mn-board').getBoundingClientRect();
  const one = (e, label) => {
    const r = e.getBoundingClientRect();
    out.push({ label, color: getComputedStyle(e).color, fs: getComputedStyle(e).fontSize,
      fw: getComputedStyle(e).fontWeight,
      x: r.x - bd.x, y: r.y - bd.y, w: r.width, h: r.height });
  };
  one(document.querySelector('.mn-bt'), 'baslik LIDERLIK');
  document.querySelectorAll('.mn-row').forEach((li) => {
    const n = li.querySelector('em').textContent;
    one(li.querySelector('em'), n + '.sira-no');
    one(li.querySelector('b'), n + '.isim');
    one(li.querySelector('span'), n + '.skor');
  });
  one(document.querySelector('.mn-lead'), 'altbilgi');
  return out;
});
// Enjeksiyon sirasinda okunduysa tum olcum anlamsizlasir — erken dur.
if (texts.some((t) => /rgba\(0,\s*0,\s*0,\s*0\)/.test(t.color))) {
  console.log('OKUMA HATASI: metin renkleri seffaf dondu (enjeksiyonla cakisti)');
  await b.close(); process.exit(2);
}

// (A) metin gorunur
const normal = Buffer.from(await shot());

// (B) metin seffaf — arka plan aynen kalir (dolgu/gradyan etkilenmez)
const tag = await p.addStyleTag({
  content: '.mn-board em, .mn-board b, .mn-board span, .mn-bt, .mn-lead { color: transparent !important; }',
});
await sleep(150);
const bgOnly = Buffer.from(await shot());
await tag.evaluate((e) => e.remove());

// (B)'yi canvas'a yukle, glif maskesini (A)-(B) farkindan al
const urlB = 'data:image/png;base64,' + bgOnly.toString('base64');
const urlA = 'data:image/png;base64,' + normal.toString('base64');
const res = await p.evaluate(async ([ua, ub, items]) => {
  const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
  const ia = await load(ua), ib = await load(ub);
  const c = document.createElement('canvas');
  c.width = ia.width; c.height = ia.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(ib, 0, 0); const B = x.getImageData(0, 0, c.width, c.height).data;
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(ia, 0, 0); const A = x.getImageData(0, 0, c.width, c.height).data;

  return items.map((it) => {
    const x0 = Math.max(0, Math.floor(it.x)), y0 = Math.max(0, Math.floor(it.y));
    const x1 = Math.min(c.width, Math.ceil(it.x + it.w)), y1 = Math.min(c.height, Math.ceil(it.y + it.h));
    let r = 0, g = 0, bl = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let xx = x0; xx < x1; xx++) {
      const k = (y * c.width + xx) * 4;
      const d = Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]);
      if (d > 60) { r += B[k]; g += B[k + 1]; bl += B[k + 2]; n++; }
    }
    // Glif yoksa (orn. seffaf zeminde tamamen kaybolan) tum kutunun medyanini al
    if (n < 4) {
      const px = [];
      for (let y = y0; y < y1; y++) for (let xx = x0; xx < x1; xx++) {
        const k = (y * c.width + xx) * 4; px.push([B[k], B[k + 1], B[k + 2]]);
      }
      px.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
      const m = px[Math.floor(px.length / 2)] || [0, 0, 0];
      return { ...it, bg: m, glif: 0 };
    }
    return { ...it, bg: [r / n, g / n, bl / n].map(Math.round), glif: n };
  });
}, [urlA, urlB, texts]);

console.log('\n== WCAG kontrast — LIDERLIK KARTI (gercek piksel, glif maskesi) ==');
console.log('  ' + 'metin'.padEnd(20) + 'renk'.padEnd(20) + 'arka plan'.padEnd(18) + 'oran    AA   AAA   boyut');
for (const r of res) {
  const cr = ratio(parse(r.color), r.bg);
  const px = parseFloat(r.fs);
  const large = px >= 24 || (px >= 18.66 && +r.fw >= 700);
  const aa = large ? cr >= 3 : cr >= 4.5;
  const aaa = large ? cr >= 4.5 : cr >= 7;
  if (!aa) fail++;
  console.log('  ' + r.label.padEnd(20) + r.color.padEnd(20) +
    ('rgb(' + r.bg.join(',') + ')').padEnd(18) +
    cr.toFixed(2).padEnd(8) + (aa ? 'OK' : 'HATA').padEnd(6) +
    (aaa ? 'OK' : '-').padEnd(6) + r.fs + '/' + r.fw + (r.glif ? '' : '  (glif yok)'));
}

console.log(fail === 0 ? '\n  TUMU WCAG GECTI ✓' : '\n  ' + fail + ' METIN WCAG GECTI DEGIL');
await b.close();
process.exit(fail ? 1 : 0);

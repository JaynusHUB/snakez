import { chromium } from 'playwright';

const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  [OK]   ' : '  [HATA] ') + msg);
  if (!cond) fail++;
};

/* ── HATA 2: yuva önizlemesi dikey ortalanmış mı? ───────────────────── */
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 }, reducedMotion: 'reduce' });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await sleep(3500);
  const g = await p.evaluate(() =>
    [...document.querySelectorAll('.mn-chip')].map((e) => {
      const cv = e.querySelector('canvas');
      const cx = cv.getContext('2d');
      const W = cv.width, H = cv.height, d = cx.getImageData(0, 0, W, H).data;
      let mn = H, mx = -1, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4;
        if (d[k + 3] > 25) { n++; if (y < mn) mn = y; if (y > mx) mx = y; }
      }
      return { kutu: [mn, mx], m: +((mn + mx) / 2).toFixed(1), n };
    }),
  );
  const kutu = [...new Set(g.map((x) => x.kutu.join('..')))];
  const merk = [...new Set(g.map((x) => x.m))];
  const pik = [...new Set(g.map((x) => x.n))];
  console.log('\n== HATA 2 — yuva ici yilan dalgasi ==');
  console.log('  icerik ' + JSON.stringify(kutu) + '  merkezY={' + merk + '} (hedef 13.5)  piksel={' + pik + '}');
  console.log('  ust kesik: ' + g.filter((x) => x.kutu[0] === 0).length + '/' + g.length + '   alt kesik: ' + g.filter((x) => x.kutu[1] === 27).length + '/' + g.length);
  // Duz renkli skinler (ilk 15) birebir ayni kalmali; sprite'li skinler
  // (15+) farkli gorunur ama ortali ve dolu olmali.
  const duz = g.slice(0, 15);
  const spr = g.slice(15);
  const duzPik = [...new Set(duz.map((x) => x.n))];
  const duzKutu = [...new Set(duz.map((x) => x.kutu.join('..')))];
  const duzMerk = [...new Set(duz.map((x) => x.m))];
  ok(duzKutu.length === 1, '15/15 duz skinde icerik kutusu birebir ayni: ' + duzKutu.join(', '));
  ok(duzMerk.length === 1 && duzMerk[0] === 13.5, 'duz skinler merkezY = 13.5 (canvas merkezi) — hepsi hizali');
  ok(duzPik.length === 1, '15/15 duz skinde ayni piksel sayisi: ' + duzPik.join(','));
  ok(spr.length > 0 && spr.every((x) => x.n > 500), spr.length + '/' + spr.length + ' sprite skin onizlemesi dolu (en az ' + Math.min(...spr.map((x) => x.n)) + ' piksel)');
  // Portre kadraj: her skin farkli sanat — kutular birebir olamaz; hepsi
  // kutuyu doldurur (kirpma yok) ve dikeyde ortalidir.
  ok(spr.every((x) => (x.kutu[1] - x.kutu[0]) >= 20 && Math.abs(x.m - 13.5) <= 1.5),
    'sprite portreler kutuya sigiyor ve ortali (' + spr.map((x) => x.kutu.join('..') + '/' + x.m).join(' ') + ')');
  await p.close();
}

/* ── HATA 1: secimde yilan donuyor mu, disarida kalkiyor mu? ────────── */
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 }, reducedMotion: 'reduce' });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await sleep(3500);
  // Yeni tasarim: bas SABIT, govde yerinde dalgalanir. Hareket = ardisik
  // kareler arasi parlaklik farki (agirlik merkezi kaymaz, o yuzden
  // eski "mx kaymasi" olcusu gecerli degil).
  const sig = () => p.evaluate(() => {
    const cv = document.querySelector('.mn-cv'), cx = cv.getContext('2d');
    const W = cv.width, H = cv.height, d = cx.getImageData(0, 0, W, H).data;
    const out = [];
    for (let y = 0; y < H; y += 12) for (let x = 0; x < W; x += 12) {
      const i = (y * W + x) * 4;
      out.push(d[i] + d[i + 1] + d[i + 2]);
    }
    return out;
  });
  const diff = (a, c) => a.reduce((s, v, i) => s + Math.abs(v - c[i]), 0) / a.length;
  const serie = async (n, gap) => {
    const out = [];
    let prev = await sig();
    for (let i = 0; i < n; i++) { await sleep(gap); const cur = await sig(); out.push(+diff(prev, cur).toFixed(2)); prev = cur; }
    return out;
  };
  const ort = (a) => a.reduce((s, v) => s + v, 0) / a.length;

  console.log('\n== HATA 1 — dalga hareketi ve kilit ==');
  const serbest = await serie(4, 600);
  console.log('  serbest dalga: ' + serbest.join(' -> ') + '  (ort ' + ort(serbest).toFixed(2) + ')');
  ok(ort(serbest) > 0.4, 'serbest akista govde DALGALANIYOR (ort fark ' + ort(serbest).toFixed(2) + ')');

  const chip = p.locator('.mn-chip').nth(6);
  await chip.hover(); await sleep(400);
  await chip.click();
  await sleep(1200); // yumusak kilit + gecis animasyonu bitsin
  const donmu = await serie(5, 500);
  const donmaMax = Math.max(...donmu);
  console.log('  secim sonrasi: ' + donmu.join(' -> ') + '  (maks ' + donmaMax.toFixed(2) + ')');
  ok(donmaMax < 0.25, 'SECIMDEN SONRA DALGA DONUK (maks fark ' + donmaMax.toFixed(2) + ')');

  // 3 saniye bekle: eski `grace` suresi dolmisti. Hala donuk mu?
  await sleep(3000);
  const gec = await serie(4, 500);
  const gecMax = Math.max(...gec);
  console.log('  +5sn sonra   : ' + gec.join(' -> ') + '  (maks ' + gecMax.toFixed(2) + ')');
  ok(gecMax < 0.15, '5.5 SANIYE SONRA HALA DONUK (maks fark ' + gecMax.toFixed(2) + ')');

  // Disaritikinca kalkmali
  await p.mouse.click(700, 300); // bant bosluğu
  await sleep(900);
  const acik = await serie(4, 600);
  console.log('  disari tik   : ' + acik.join(' -> ') + '  (ort ' + ort(acik).toFixed(2) + ')');
  ok(ort(acik) > 0.4, 'DISARI TIKLAYINCA DALGA DEVAM EDIYOR (ort fark ' + ort(acik).toFixed(2) + ')');
  await p.close();
}

/* ── YENI: onizleme (spot + olcek + ad levhasi) ─────────────────────── */
{
  for (const [W, H] of [[1920, 950], [1600, 900], [1440, 900], [1366, 768], [1280, 800], [1024, 768]]) {
    const p = await b.newPage({ viewport: { width: W, height: H }, reducedMotion: 'reduce' });
    await p.goto('http://localhost:5173', { waitUntil: 'load' });
    await sleep(3000);

    const parlak = () => p.evaluate(() => {
      const cv = document.querySelector('.mn-cv'), cx = cv.getContext('2d');
      const W = cv.width, H = cv.height, d = cx.getImageData(0, 0, W, H).data;
      let n = 0, tot = 0;
      for (let y = 0; y < H; y += 5) for (let x = 0; x < W; x += 5) {
        const i = (y * W + x) * 4; tot++;
        if (d[i + 3] > 40 && (d[i] + d[i + 1] + d[i + 2]) > 90) n++;
      }
      return (n / tot) * 100;
    });

    const once = await parlak();
    const chip = p.locator('.mn-chip').nth(9); // "Gökkuşağı" — en uzun ad, en kötü durum
    await chip.hover(); await sleep(400); await chip.click();
    await sleep(1400);
    const sonra = await parlak();

    const lab = await p.evaluate(() => {
      const e = document.querySelector('.mn-hero');
      const t = document.querySelector('[data-heroname-txt]');
      const cs = getComputedStyle(e);
      if (cs.display === 'none') return null;
      const r = e.getBoundingClientRect();
      const R = (s) => {
        const x = document.querySelector(s);
        if (!x || getComputedStyle(x).display === 'none') return null;
        const q = x.getBoundingClientRect();
        return [q.x, q.y, q.right, q.bottom];
      };
      const hit = (a, b) => a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      const box = [r.x, r.y, r.right, r.bottom];
      return {
        txt: t.textContent, op: +cs.opacity, w: Math.round(r.width), h: Math.round(r.height),
        box: [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)],
        deck: hit(box, R('.mn-deck')), board: hit(box, R('.mn-board')),
        keys: hit(box, R('.mn-keys')), tele: hit(box, R('.mn-tele')),
        copy: hit(box, R('.mn-copy')),
        icinde: r.x >= -1 && r.right <= innerWidth + 1 && r.y >= -1 && r.bottom <= innerHeight + 1,
      };
    });

    const etiket = String(W + 'x' + H).padEnd(10);
    if (!lab) {
      ok(false, etiket + ' ad levhasi GORUNUR DEGIL');
    } else {
      const cak = ['deck', 'board', 'keys', 'tele', 'copy'].filter((k) => lab[k]);
      console.log('  ' + etiket + ' levha "' + lab.txt + '" op=' + lab.op + ' ' + lab.w + 'x' + lab.h + ' ' + JSON.stringify(lab.box) +
        '  isik ' + once.toFixed(1) + '%->' + sonra.toFixed(1) + '%');
      ok(lab.txt === 'Gökkuşağı', etiket + ' levha metni "' + lab.txt + '" = Gökkuşağı olmali');
      ok(lab.op > 0.97, etiket + ' levha tam gorunur (op=' + lab.op + ')');
      ok(lab.icinde, etiket + ' levha ekrani tasmiyor');
      ok(cak.length === 0, etiket + ' ustune binen katman yok' + (cak.length ? ' — CAKISAN: ' + cak.join(',') : ''));
      ok(sonra > once * 1.25, etiket + ' spot isigi belirgin: ' + once.toFixed(1) + '% -> ' + sonra.toFixed(1) + '%');
    }
    await p.close();
  }
}

/* ── DISARIDAKILER: motor degismedi, yazilim bozulmadi ──────────────── */
console.log('\n== Ozet ==');
console.log(fail === 0 ? '  TUM KONTROLLER GECTI ✓' : '  ' + fail + ' HATA');
await b.close();
process.exit(fail ? 1 : 0);

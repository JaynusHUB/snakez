import { chromium } from 'playwright';

// Adil görüş testi: kamera zoom formülünün ekran boyutundan bağımsızlığı.
//
// Matematik: zt = (sqrt(W*H)/900) * sqrt(9.6/pr)  [+ geniş ekranda
// sqrt(aspect/(16/9)) çarpanı]. Görünen genişlik W/z, aynı en-boy oranında
// pencere büyüdükçe SABİT kalır; 16:9'dan genişte referans genişliğe
// sabitlenir (3440x1440 eskiden %16 fazla dünya gösterirdi).
//
// Referans: 1920x1080 @%100. %50 zoom == 3840x2160 CSS pikseli (oran aynı),
// bu yüzden ayrı bir "zoom" durumu değil, aynı ölçümdür.

const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  [OK]   ' : '  [HATA] ') + msg);
  if (!cond) fail++;
};

const REF_A = 1920 / 1080;

// Bir kadrajda oyunu başlatıp kamera yakınsamasını bekle, ölç.
// Dönüş: { W, H, z, pr, visible } ya da null (doğum ölümlerine karşı 4 deneme).
async function olc(viewport, deviceScaleFactor) {
  for (let deneme = 0; deneme < 4; deneme++) {
    const p = await b.newPage({ viewport, deviceScaleFactor });
    const hatalar = [];
    p.on('pageerror', (e) => hatalar.push('pageerror:' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') hatalar.push('console:' + m.text()); });
    await p.goto('http://localhost:5173', { waitUntil: 'load' });
    await sleep(2500);
    await p.click('[data-go]');
    // Fareyi merkeze al: yılan düğmeye değil, doğduğu bölgeye yönelir
    // (duvar ölümleri azalır, ölçüm stabil olur).
    await p.mouse.move(viewport.width / 2, viewport.height / 2);
    await sleep(4000); // z zaman sabiti 0.4sn → 10τ, tam yakınsama
    const r = await p.evaluate(() => {
      const g = window.__menu && window.__menu.game;
      const me = g && g.me;
      if (!me || !me.alive) return null;
      return { W: window.innerWidth, H: window.innerHeight, z: g.cam.z, pr: me.r, dpr: window.devicePixelRatio };
    });
    await p.close();
    if (!r) continue;
    // z alt sınırı oyunun, üst sınırı adil-görüş tavanının (dev ekranda 3'ü
    // aşar; 8 üst sınırı yalnızca patlamış değere karşı emniyet).
    if (!Number.isFinite(r.z) || r.z < 0.22 || r.z > 8) continue;
    return { ...r, visible: r.W / r.z, hatalar };
  }
  return null;
}

console.log('\n== Adil gorus — olcumler ==');
console.log('  (kadro | olculen z | beklenen z | gorunen genislik | tavan | eski formul)');

const sonuclar = {};
for (const k of [
  { ad: '1280x720', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  { ad: '1920x1080', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  { ad: '3840x2160', viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 }, // %50 zoom esdegeri
  { ad: '1920x1080@2x', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 },
  { ad: '3440x1440', viewport: { width: 3440, height: 1440 }, deviceScaleFactor: 1 }, // 21:9 ultra-wide
  { ad: '2560x1080', viewport: { width: 2560, height: 1080 }, deviceScaleFactor: 1 }, // 21:9
  { ad: '390x844', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, // telefon
]) {
  const r = await olc(k.viewport, k.deviceScaleFactor);
  ok(!!r, k.ad + ': oyun basladi, kamera okundu' + (r ? '' : ' (4 denemede olen dogum)'));
  if (!r) continue;
  const F = Math.sqrt(r.W * r.H) / 900;
  const S = Math.sqrt(9.6 / r.pr);
  const aspect = r.W / r.H;
  const carp = aspect > REF_A ? Math.sqrt(aspect / REF_A) : 1;
  // Tavan, adil-görüş tabanını ezmez: zt > 3 ise hedef zt'nin kendisi
  // (üst sınır yalnızca zt <= 3 iken 3.0'dır).
  const ztHam = F * S * carp;
  const beklenen = Math.max(ztHam, 0.22);
  const tavan = (900 * Math.sqrt(REF_A)) / S; // referans genislik (ayni pr)
  const eski = (900 * Math.sqrt(aspect)) / S; // duzeltme oncesi gosterecegi
  console.log(`  ${k.ad}: z=${r.z.toFixed(3)} ~ ${beklenen.toFixed(3)} | gorunen=${r.visible.toFixed(0)} <= ${tavan.toFixed(0)} | eski=${eski.toFixed(0)}`);
  ok(Math.abs(r.z - beklenen) / beklenen <= 0.05, `${k.ad}: z formulu tutuyor (sapma %${(100 * Math.abs(r.z - beklenen) / beklenen).toFixed(1)})`);
  ok(r.visible <= tavan * 1.05, `${k.ad}: gorunen genislik tavani asmiyor`);
  ok(r.hatalar.length === 0, `${k.ad}: konsol hatasi yok` + (r.hatalar.length ? ' (' + r.hatalar.join(' | ') + ')' : ''));
  sonuclar[k.ad] = { visible: r.visible, tavan, eski };
}

// Ayni oran, farkli boy: 1280x720 / 1920x1080 / 3840x2160 ayni dunyayi gormeli.
if (sonuclar['1280x720'] && sonuclar['1920x1080'] && sonuclar['3840x2160']) {
  const vs = ['1280x720', '1920x1080', '3840x2160'].map((k) => sonuclar[k].visible);
  const ort = vs.reduce((a, x) => a + x, 0) / vs.length;
  const yay = Math.max(...vs.map((x) => Math.abs(x - ort) / ort));
  ok(yay <= 0.06, `16:9 kadrajlar ayni alani goruyor (yayilim %${(100 * yay).toFixed(1)}): ${vs.map((x) => x.toFixed(0)).join(' / ')}`);
}

// Ultra-wide kazi: duzeltme oncesi 3440x1440 referansin %16 uzerinde gosterirdi.
if (sonuclar['3440x1440']) {
  const s = sonuclar['3440x1440'];
  ok(s.eski > s.tavan * 1.1, `duzeltme 3440x1440 avantajini kaldiriyor (eski ${s.eski.toFixed(0)} -> simdi ${s.visible.toFixed(0)}, tavan ${s.tavan.toFixed(0)})`);
  ok(s.visible <= s.tavan * 1.05, '3440x1440 tavanda');
}

await b.close();
console.log(fail ? `\n${fail} HATA` : '\nTUM KONTROLLER GECTI ✓');
process.exit(fail ? 1 : 0);

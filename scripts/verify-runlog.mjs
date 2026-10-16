import { chromium } from 'playwright';

// B2 regresyonu (denetim raporu): ölüm -> sekme gizle -> geri gel akışında
// sıfırlama yalnız OYUNCU CANLIYKEN yapılmalı; ölüm penceresinde bekleyen tur
// TEKRAR (runlog kimlik değişimi) ve MENÜ (meta commitRun) yollarında
// OYUN/REKOR'a işlenmeli, çift sayılmamalı.
const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  [OK]   ' : '  [HATA] ') + msg);
  if (!cond) fail++;
};
const URL = 'http://localhost:5173';

function watch(p) {
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  return errs;
}

// Gerçek sekme gizlemesi başsız tarayıcıda üretilemiyor (denetim notu).
// İşleyici `document.hidden`'ı GERÇEK okur; biz durumu property gölgelemeyle
// yazıp visibilitychange'i tetikleriz — işleyici yolu birebir aynı çalışır.
async function gizleGoster(p) {
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(250);
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(250);
}

async function oyunaBasla(p, ad) {
  await p.goto(URL, { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('.mn-go', { timeout: 8000 });
  await sleep(700);
  await p.fill('[data-name]', ad);
  await p.press('[data-name]', 'Enter');
  await p.waitForFunction(() => { const g = window.__menu?.game; return !!(g?.me && g.me.alive); }, null, { timeout: 15000 });
  await sleep(400);
}

async function oldur(p) {
  await p.evaluate(() => { const g = window.__menu.game; if (g.me?.alive) g.kill(g.me, 0); });
  await p.waitForSelector('[data-act="retry"]', { state: 'visible', timeout: 8000 });
  await sleep(400);
}

const depo = (p) => p.evaluate(() => ({
  best: localStorage.getItem('snakez.best'),
  games: localStorage.getItem('snakez.games'),
  metaBest: localStorage.getItem('snakez.meta.best'),
}));
const levha = (p) => p.evaluate(() => ({
  best: document.querySelector('[data-best]')?.textContent ?? null,
  games: document.querySelector('[data-games]')?.textContent ?? null,
}));

console.log('\n== TEKRAR yolu: olum -> gizle -> TEKRAR OYNA ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p, 'GizliTekrar');
  await oldur(p);
  const d0 = await depo(p);
  ok(Number(d0.metaBest) > 0 && d0.games === null, `olum: meta.best yazildi (${d0.metaBest}), OYUN henuz yok`);
  await gizleGoster(p);
  await p.click('[data-act="retry"]');
  await p.waitForFunction(() => { const g = window.__menu?.game; return !!(g?.me && g.me.alive); }, null, { timeout: 15000 });
  await sleep(1000);
  const d1 = await depo(p);
  ok(d1.games === '1', `TEKRAR sonrasi OYUN = 1 (${d1.games})`);
  ok(d1.best === d0.metaBest, `REKOR = ilk turun skoru (${d1.best} = ${d0.metaBest})`);
  // Ikinci tur: olum -> gizle -> MENU. Cift sayim olmamali.
  await oldur(p);
  const d2 = await depo(p);
  ok(d2.games === '1', `ikinci olumde OYUN hala 1 (henuz kayit yok: ${d2.games})`);
  await gizleGoster(p);
  await p.click('[data-act="menu"]');
  await p.waitForSelector('.mn-go', { timeout: 8000 });
  await sleep(700);
  const d3 = await depo(p);
  const L = await levha(p);
  ok(d3.games === '2', `MENU sonrasi OYUN = 2, cift sayim yok (${d3.games})`);
  ok(d3.best === d3.metaBest, `REKOR meta ile tutarli (${d3.best})`);
  ok(L.best === d3.best && L.games === '2', `menu levhasi guncel: REKOR=${L.best} OYUN=${L.games}`);
  ok(errs.length === 0, `konsol hatasi yok (${errs.join(' | ') || 'temiz'})`);
  await p.close();
}

console.log('\n== MENU yolu: olum -> gizle -> MENU ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p, 'GizliMenu');
  await oldur(p);
  const d0 = await depo(p);
  await gizleGoster(p);
  await p.click('[data-act="menu"]');
  await p.waitForSelector('.mn-go', { timeout: 8000 });
  await sleep(700);
  const d1 = await depo(p);
  const L = await levha(p);
  ok(d1.games === '1', `MENU turu sayildi (${d1.games})`);
  ok(d1.best === d0.metaBest, `REKOR menude dogru (${d1.best})`);
  ok(L.best === d1.best, `menu levhasi REKOR=${L.best}`);
  ok(errs.length === 0, `konsol hatasi yok (${errs.join(' | ') || 'temiz'})`);
  await p.close();
}

console.log('\n== Canliyken gizle: sahte kayit yok, tur kaybolmaz ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p, 'GizliCanli');
  await gizleGoster(p); // canliyken gizleme: sifirlama beklenir
  const d0 = await depo(p);
  ok(d0.games === null && d0.best === null, `canliyken gizleme kayit uretmez (games=${d0.games})`);
  await oldur(p);
  await gizleGoster(p); // olum penceresinde gizleme: bekleyen tur korunur
  await p.click('[data-act="retry"]');
  await p.waitForFunction(() => { const g = window.__menu?.game; return !!(g?.me && g.me.alive); }, null, { timeout: 15000 });
  await sleep(1000);
  const d1 = await depo(p);
  ok(d1.games === '1' && Number(d1.best) > 0, `tur TEKRAR ile sayildi (games=${d1.games}, best=${d1.best})`);
  ok(errs.length === 0, `konsol hatasi yok (${errs.join(' | ') || 'temiz'})`);
  await p.close();
}

console.log('\n== Kontrol: gizleme yok, TEKRAR ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await oyunaBasla(p, 'Kontrol');
  await oldur(p);
  await p.click('[data-act="retry"]');
  await p.waitForFunction(() => { const g = window.__menu?.game; return !!(g?.me && g.me.alive); }, null, { timeout: 15000 });
  await sleep(1000);
  const d = await depo(p);
  ok(d.games === '1' && Number(d.best) > 0, `gizlemesiz tur sayildi (games=${d.games}, best=${d.best})`);
  await p.close();
}

await b.close();
console.log(fail ? `\n${fail} HATA` : '\nTUM KONTROLLER GECTI ✓');
process.exit(fail ? 1 : 0);

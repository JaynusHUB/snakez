import { chromium } from 'playwright';

// Olum yemi efektleri: 8 premium skin -> tema; secim, katil yolu, deger
// korunumu, eski kayit, bulut anahtari, market rozeti, FPS, dusuk kalite.
const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  [OK]   ' : '  [HATA] ') + msg);
  if (!cond) fail++;
};
function watch(p) {
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  return errs;
}
async function oyunaBasla(p) {
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForSelector('.mn-go', { timeout: 8000 });
  await sleep(700);
  await p.fill('[data-name]', 'Efektci');
  await p.press('[data-name]', 'Enter');
  await sleep(500);
}

console.log('\n== Secim: 8 premium + duz skin ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p);
  const r = await p.evaluate(() => {
    const g = window.__menu.game;
    const out = [];
    // idx -> tema: 15:1, 17:2, 19:3, 16:4, 18:5, 20:6, 21:7, 22:8, 0:0
    const bekle = { 15: 1, 17: 2, 19: 3, 16: 4, 18: 5, 20: 6, 21: 7, 22: 8, 0: 0 };
    for (const idx of [15, 17, 19, 16, 18, 20, 21, 22, 0]) {
      g.food.cells.clear(); g.food.count = 0; g.food.regular = 0;
      g.me.skin = idx; g.me.alive = true;
      g.kill(g.me, 0);
      let n = 0, hepsi = true, fx = -1, deger = true;
      for (const a of g.food.cells.values()) for (const q of a) {
        n++;
        if (q.fx === undefined) hepsi = false;
        if (fx === -1) fx = q.fx; else if (q.fx !== fx) hepsi = false;
        if (!(q.v > 0 && q.r > 0)) deger = false;
      }
      out.push({ idx, n, fx, hepsi, deger });
    }
    return out;
  });
  // Sayi formulu kutleye bagli (mass buyudukce artar); efekt etiketi sayiyi
  // degistirmez: 9 kosuda da ayni adet cikmali (isitma yemesi kitleyi oynatabilir).
  ok(r.every((x) => x.n === r[0].n && x.n >= 3), `olum basina esit yem (sayi korunur): ${r.map((x) => x.n).join(',')}`);
  ok(r.every((x) => x.hepsi), 'tum yemler fx etiketli');
  ok(r.every((x) => x.deger), 'v/r degerleri gecerli');
  const eslesme = r.filter((x) => x.fx === ({ 15: 1, 17: 2, 19: 3, 16: 4, 18: 5, 20: 6, 21: 7, 22: 8, 0: 0 })[x.idx]);
  ok(eslesme.length === 9, `tema eslemesi 9/9 (duz skin 0 dahil): ${r.map((x) => x.idx + '->' + x.fx).join(' ')}`);
  ok(new Set(r.slice(0, 8).map((x) => x.fx)).size === 8, '8 premiumda 8 farkli tema');
  ok(hatalarYok(errs), 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Katil yolu: olen kimse onun temasi duser ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p);
  const r = await p.evaluate(() => {
    const g = window.__menu.game;
    const canlilar = () => g.snakes.filter((s) => s.bot && s.alive);
    g.me.skin = 15; g.me.alive = true; // Ben Krampus'um.
    const b1 = canlilar()[0], rest = canlilar().slice(1);
    if (!b1 || rest.length < 1) return { yok: true };
    // Eledigim Red Wolf botu: benim skinim degil, KURBANIN temasi duser.
    b1.skin = 19;
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 0;
    g.kill(b1, g.me.id);
    const fx1 = new Set();
    for (const a of g.food.cells.values()) for (const q of a) fx1.add(q.fx);
    // Bot-bot: XEN botu baska botca yenirse XEN yemi duser (herkes gorur).
    const b2 = canlilar()[0];
    if (!b2) return { yok: true };
    const k2 = canlilar().find((s) => s !== b2);
    if (!k2) return { yok: true };
    b2.skin = 18; k2.skin = 0;
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 0;
    g.kill(b2, k2.id);
    const fx2 = new Set();
    for (const a of g.food.cells.values()) for (const q of a) fx2.add(q.fx);
    // Normal skinli bot olurse klasik yem (bot-bot da olsa).
    const b3 = canlilar()[0];
    if (!b3) return { yok: true };
    const k3 = canlilar().find((s) => s !== b3);
    if (!k3) return { yok: true };
    b3.skin = 0;
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 0;
    g.kill(b3, k3.id);
    const fx3 = new Set();
    for (const a of g.food.cells.values()) for (const q of a) fx3.add(q.fx);
    return { fx1: [...fx1], fx2: [...fx2], fx3: [...fx3] };
  });
  ok(!r.yok && r.fx1.length === 1 && r.fx1[0] === 3, `eledigim Red Wolf redwolf yemli (${JSON.stringify(r.fx1)})`);
  ok(!r.yok && r.fx2.length === 1 && r.fx2[0] === 5, `bot-bot XEN olumu xen yemli (${JSON.stringify(r.fx2)})`);
  ok(!r.yok && r.fx3.length === 1 && r.fx3[0] === 0, `normal skin klasik yem (${JSON.stringify(r.fx3)})`);
  ok(hatalarYok(errs), 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Eski kayit + bulut anahtari ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snakez.name', 'Eski');
    localStorage.setItem('snakez.best', '12');
    localStorage.setItem('snakez.games', '3');
    localStorage.setItem('snakez.skin', '0');
  });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForSelector('.mn-go', { timeout: 8000 });
  await sleep(700);
  await p.press('[data-name]', 'Enter');
  await sleep(500);
  const r = await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.alive = true;
    g.kill(g.me, 0);
    return { mode: g.me && g.me.alive ? 'play' : 'idle', fx: [...g.food.cells.values()].flatMap((a) => a.map((q) => q.fx)) };
  });
  ok(r.fx.length > 0 && r.fx.every((x) => x === 0), 'eski kayit: oyun acar, yemler duz');
  const keys = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('snakez.')));
  const izin = ['snakez.name', 'snakez.best', 'snakez.games', 'snakez.skin', 'snakez.meta', 'snakez.meta.best', 'snakez.fx', 'snakez.quality', 'snakez.fps', 'snakez.chest', 'snakez.career', 'snakez.sync'];
  const yabanci = keys.filter((k) => !izin.includes(k) && !k.startsWith('snakez.backup.'));
  ok(yabanci.length === 0, `yeni anahtar yok (${yabanci.join(',') || 'temiz'})`);
  ok(hatalarYok(errs), 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Market rozeti + 390px tasma ==');
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watch(p);
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForSelector('#meta .mt-pf [data-act="shop"]', { timeout: 8000 });
  await p.locator('#meta .mt-pf [data-act="shop"]').click();
  await p.waitForSelector('#meta [data-shop] .mk-card', { timeout: 5000 });
  await sleep(800);
  const r = await p.evaluate(() => {
    const rozetler = [...document.querySelectorAll('#meta [data-shop] .mk-death')];
    const pix = [];
    for (const s of rozetler) {
      const cv = s.querySelector('canvas');
      if (!cv) { pix.push(0); continue; }
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++;
      pix.push(n);
      if (s.textContent.trim() !== 'Ölüm yemi efekti dahil') pix.push(-999);
    }
    return { adet: rozetler.length, pix };
  });
  ok(r.adet === 8, `8 premium kartta rozet (${r.adet})`);
  ok(r.pix.every((n) => n > 50), 'rozet onizlemeleri boyali');
  ok(hatalarYok(errs), 'konsol hatasi yok');
  await p.close();

  const q = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs2 = watch(q);
  await q.goto('http://localhost:5173', { waitUntil: 'load' });
  await q.evaluate(() => localStorage.clear());
  await q.goto('http://localhost:5173', { waitUntil: 'load' });
  await q.waitForSelector('#meta .mt-pf [data-act="shop"]', { timeout: 8000 });
  await q.locator('#meta .mt-pf [data-act="shop"]').click();
  await q.waitForSelector('#meta [data-shop] .mk-card', { timeout: 5000 });
  await sleep(800);
  const tasma = await q.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const adet2 = await q.evaluate(() => document.querySelectorAll('#meta [data-shop] .mk-death').length);
  ok(!tasma && adet2 === 8, `390px: tasma yok, 8 rozet yerinde`);
  ok(hatalarYok(errs2), 'konsol hatasi yok');
  await q.close();
}

console.log('\n== FPS: 600 fx yem ekrandayken ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p);
  await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 18; g.me.alive = true;
    const botlar = g.snakes.filter((s) => s.bot && s.alive).slice(0, 3);
    for (const o of botlar) { o.mass = 2500; o.x = g.me.x + 40; o.y = g.me.y; g.kill(o, g.me.id); }
  });
  const sayi = await p.evaluate(() => {
    let n = 0;
    for (const a of window.__menu.game.food.cells.values()) n += a.length;
    return n;
  });
  console.log(`  ekranda ~${sayi} yem (fx'li yiginlar)`);
  const fps = await p.evaluate(() => new Promise((res) => {
    const ts = [];
    const t0 = performance.now();
    const tick = (t) => { ts.push(t); if (t - t0 < 3000) requestAnimationFrame(tick); else res(ts); };
    requestAnimationFrame(tick);
  }));
  const d = fps.slice(1).map((t, i) => t - fps[i]).sort((a, x) => a - x);
  const avg = d.reduce((a, x) => a + x, 0) / d.length;
  const p95 = d[Math.floor(d.length * 0.95)];
  console.log(`  kare=${d.length} ort=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
  ok(avg <= 70, `ortalama kare ${avg.toFixed(1)}ms (sinir 70ms)`);
  ok(p95 <= 120, `p95 kare ${p95.toFixed(1)}ms (sinir 120ms)`);
  ok(hatalarYok(errs), 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Sakin mod + dusuk kalite ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const errs = watch(p);
  await oyunaBasla(p);
  await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 15; g.me.alive = true;
    g.kill(g.me, 0);
  });
  await sleep(800);
  ok(hatalarYok(errs), 'sakin mod: konsol hatasi yok');
  await p.close();

  const q = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs2 = watch(q);
  await q.goto('http://localhost:5173', { waitUntil: 'load' });
  await q.evaluate(() => { localStorage.clear(); localStorage.setItem('snakez.quality', 'low'); });
  await q.goto('http://localhost:5173', { waitUntil: 'load' });
  await q.waitForSelector('.mn-go', { timeout: 8000 });
  await sleep(700);
  await q.fill('[data-name]', 'Dusuk');
  await q.press('[data-name]', 'Enter');
  await sleep(500);
  await q.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 22; g.me.alive = true;
    g.kill(g.me, 0);
  });
  await sleep(800);
  ok(hatalarYok(errs2), 'dusuk kalite: konsol hatasi yok');
  await q.close();
}

function hatalarYok(e) { return e.length === 0; }
await b.close();
console.log(fail ? `\n${fail} HATA` : '\nTUM KONTROLLER GECTI ✓');
process.exit(fail ? 1 : 0);

import { chromium } from 'playwright';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// Ölüm yemi sprite hattı: oyun içi hat (ağ isteği kanıtlı yükleme), skin
// değişimi, değer korunumu, yüklenemezse düz yem, dist temizliği.
// (DEV galeri ve __deathfood kancası kaldırıldı; testler galerisiz çalışır.)
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
  // Kaynak yükleme hataları (bilerek abort edilen sprite) sayılmaz.
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errs.push('console:' + m.text()); });
  return errs;
}
async function oyunaBasla(p, ad = 'Sprite') {
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForSelector('.mn-go', { timeout: 8000 });
  await sleep(700);
  await p.fill('[data-name]', ad);
  await p.press('[data-name]', 'Enter');
  await sleep(500);
}

console.log('\n== Sprite yukleme + skin degisimi (oyun ici hat) ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p);
  // Olumde olen skinin tema sprite'i oyun tarafindan lazy cekilir: ag
  // isteginin 200 donmesi "sprite yuklenir"in kanitidir (kanca yok).
  const bekle = (dosya) =>
    p.waitForResponse((r) => r.url().includes('/death-food/' + dosya) && r.status() === 200, { timeout: 10000 });
  const istek8 = bekle('bluedragon.webp');
  await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 22; g.me.alive = true; // Blue Dragon -> tema 8
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 0;
    g.kill(g.me, 0);
  });
  const fx8 = await p.evaluate(() => [...new Set([...window.__menu.game.food.cells.values()].flat().map((q) => q.fx))]);
  ok(await istek8.then(() => true).catch(() => false), 'Blue Dragon olumunde bluedragon.webp yuklendi (200)');
  ok(fx8.length === 1 && fx8[0] === 8, `yemler tema 8 (${JSON.stringify(fx8)})`);
  const istek2 = bekle('werewolf.webp');
  await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 17; g.me.alive = true; // Werewolf -> tema 2
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 0;
    g.kill(g.me, 0);
  });
  const fx2 = await p.evaluate(() => [...new Set([...window.__menu.game.food.cells.values()].flat().map((q) => q.fx))]);
  ok(await istek2.then(() => true).catch(() => false), 'skin degisince werewolf.webp yuklendi (200)');
  ok(fx2.length === 1 && fx2[0] === 2, `son olum katil temasinda (fx=${fx2[0]})`);
  ok(errs.length === 0, 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Normal skin: efekt yok ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p);
  const r = await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 0; g.me.alive = true;
    g.kill(g.me, 0);
    const fx = new Set();
    for (const a of g.food.cells.values()) for (const q of a) fx.add(q.fx);
    return [...fx];
  });
  ok(r.length === 1 && r[0] === 0, `duz skin duz yem (${JSON.stringify(r)})`);
  ok(errs.length === 0, 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Kutle/deger/toplanma alani korunur ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p);
  const r = await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 22; g.me.alive = true;
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 0;
    // Ayni degerde efektli + duz yem: r/v esit mi?
    g.food.addPellet(g.me.x, g.me.y, 5, '#ffffff', -10, g.time, false, 8);
    g.food.addPellet(g.me.x + 3, g.me.y, 5, '#ffffff', -10, g.time, false, 0);
    const all = [...g.food.cells.values()].flat();
    const a = all.find((q) => q.fx === 8);
    const d = all.find((q) => q.fx === 0);
    const esit = a && d && a.r === d.r && a.v === d.v && a.v === 5;
    // Toplama: efektli yemi ye, kutle artisi = deger (refill dondurulur).
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 99999;
    g.food.addPellet(g.me.x, g.me.y, 5, '#ffffff', -10, g.time, false, 8);
    const once = g.me.mass;
    g.update(1 / 60);
    g.update(1 / 60);
    // Ucus 0.16sn surer: advanceTime ile tamamla.
    window.advanceTime(400);
    const delta = g.me.mass - once;
    return { esit, delta };
  });
  ok(r.esit, 'efektli/duz yemde r ve v esit (v=5)');
  ok(Math.abs(r.delta - 5) < 1e-6, `toplamada kutle artisi = deger (${r.delta})`);
  ok(errs.length === 0, 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Mantiksal konum animasyondan etkilenmez ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  await oyunaBasla(p);
  const r = await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 22; g.me.alive = true;
    g.snakes = g.snakes.filter((s) => s === g.me); // yalit
    g.botT = 1e9; // respawn yok
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 99999; // refill yok
    g.kill(g.me, 0);
    const anahtar = (q) => q.x + ',' + q.y + ',' + q.fx;
    const ilk = [...g.food.cells.values()].flat().map(anahtar).sort().join('|');
    window.advanceTime(2000);
    const son = [...g.food.cells.values()].flat().map(anahtar).sort().join('|');
    return { adet: ilk.split('|').length, ayni: ilk.length > 0 && ilk === son };
  });
  ok(r.ayni, `2sn sonra konum/fx aynen duruyor (${r.adet} yem)`);
  ok(errs.length === 0, 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Reduced-motion: dalga/nabiz yok, oyun saglam ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const errs = watch(p);
  await oyunaBasla(p);
  const r = await p.evaluate(() => {
    const g = window.__menu.game;
    const calm = document.documentElement.classList.contains('fx-calm');
    g.me.skin = 19; g.me.alive = true;
    g.snakes = g.snakes.filter((s) => s === g.me); // yalit
    g.botT = 1e9; // respawn yok
    g.food.cells.clear(); g.food.count = 0; g.food.regular = 99999; // refill yok
    g.kill(g.me, 0);
    window.advanceTime(1500);
    let n = 0, fx = 0;
    for (const a of g.food.cells.values()) for (const q of a) { n++; if (q.fx === 3) fx++; }
    const snap = window.render_game_to_text();
    return { calm, n, fx, snap: snap.length > 20 };
  });
  ok(r.calm, 'sakin kip acik (fx-calm)');
  ok(r.n > 0 && r.fx === r.n, `tum yemler temali (${r.fx}/${r.n})`);
  ok(r.snap, 'oyun saglam');
  ok(errs.length === 0, 'konsol hatasi yok');
  await p.close();
}

console.log('\n== Sprite yuklenemezse duz yem (ag hatasi) ==');
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = watch(p);
  let deneme = 0;
  await p.route('**/death-food/*.webp', (route) => { deneme++; return route.abort('failed'); });
  await oyunaBasla(p);
  await p.evaluate(() => {
    const g = window.__menu.game;
    g.me.skin = 22; g.me.alive = true;
    g.kill(g.me, 0);
  });
  await sleep(700);
  const r = await p.evaluate(() => {
    const g = window.__menu.game;
    let n = 0;
    for (const a of g.food.cells.values()) n += a.length;
    const snap = window.render_game_to_text();
    return { n, snap: snap.length > 20 };
  });
  ok(deneme > 0, `sprite istegi denendi ve kesildi (${deneme} kez)`);
  ok(r.n > 0 && r.snap, `oyun bozulmaz (yem=${r.n}, snapshot ok)`);
  ok(errs.length === 0, 'konsol hatasi yok (ag hatasi sayilmaz)');
  await p.close();
}

console.log('\n== dist temizligi: assets-src + galeri/DEV izi yok ==');
{
  const noSrc = !existsSync('dist/assets-src') && !existsSync('dist/deathfx-gallery.html');
  ok(noSrc, 'dist icinde assets-src ve galeri yok');
  let galeri = false, kanca = false;
  for (const f of readdirSync('dist/assets')) {
    if (!f.endsWith('.js')) continue;
    const c = readFileSync('dist/assets/' + f, 'utf8');
    if (c.includes('deathfx-gallery')) galeri = true;
    if (c.includes('__deathfood')) kanca = true;
  }
  ok(!galeri, 'uretim bundle icinde galeri kodu yok');
  ok(!kanca, 'uretim bundle icinde DEV kancasi (__deathfood) yok');
}

await b.close();
console.log(fail ? `\n${fail} HATA` : '\nTUM KONTROLLER GECTI ✓');
process.exit(fail ? 1 : 0);

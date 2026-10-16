// Meta entegrasyon kabul testleri (10 kriter). Tek kullanimlik dogrulama.
import { chromium } from 'playwright';
const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0, total = 0;
const t = (c, m) => { total++; console.log((c ? '  [GECTI] ' : '  [KALDI]  ') + m); if (!c) fail++; };
const errs = [];

const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('http://localhost:5173', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await sleep(4500);

// K2a: menude HUD yok
t(await p.evaluate(() => document.querySelector('#meta .mt-hud').hidden) === true, '2a. Menude HUD gizli');

// OYNA
await p.locator('[data-name]').fill('Test');
await p.locator('.mn-chip').nth(0).click();
await p.locator('[data-go]').click();
await sleep(1500);

// K2b: seviye halkasi + liderlik + skor seridi
const hud = await p.evaluate(() => ({
  hud: !document.querySelector('#meta .mt-hud').hidden,
  lv: document.querySelector('#meta [data-lv]').textContent.length,
  lb: document.querySelectorAll('#meta [data-lb] li').length,
  sc: document.querySelector('#meta [data-sc]').textContent.length,
}));
t(hud.hud && hud.lv > 5 && hud.lb >= 2 && hud.sc > 5, `2b. OYNA sonrasi HUD (lv:${hud.lv}ch lb:${hud.lb}satir sc:${hud.sc}ch)`);

// K3: liderlik canli + oyuncu vurgulu
const lb1 = await p.evaluate(() => document.querySelector('#meta [data-lb]').textContent);
await sleep(2500);
const lb2 = await p.evaluate(() => document.querySelector('#meta [data-lb]').textContent);
const me = await p.evaluate(() => !!document.querySelector('#meta [data-lb] li.me'));
t(lb1 !== lb2 && me, '3. Liderlik canli (2.5snde degisti) ve oyuncu satiri .me vurgulu');

const kill = () => p.evaluate(() => {
  const g = window.__menu.game, me = g.me;
  if (me && me.alive) g.kill(me, 0);
  return !!(me && me.alive === false);
});
const overOpen = () => p.evaluate(() => !document.querySelector('#meta .mt-over').hidden);

// K4: olum ekrani ~1sn + sayaclar
t(await kill(), '4a. kill() oyuncuyu oldurdu');
await sleep(1200);
t(await overOpen(), '4b. ~1sn sonra olum ekrani acildi');
const n1 = await p.evaluate(() => [...document.querySelectorAll('#meta .mt-over [data-n]')].map((e) => e.textContent));
await sleep(700);
const n2 = await p.evaluate(() => [...document.querySelectorAll('#meta .mt-over [data-n]')].map((e) => e.textContent));
t(n1.length >= 3 && n2.join() !== n1.join(), `4c. Skor/XP/coin sayiyor (${n1.join(' | ')} -> ${n2.join(' | ')})`);

// NOT (yeni arayuz): .mt-pf cipi menude de [data-act] butonlari icerir;
// olum ekrani butonlari .mt-over kapsaminda secilir (gevsetme yok, hedef daraltma).
const over = (act) => `#meta .mt-over [data-act="${act}"]`;
await p.locator(over('retry')).click();
await sleep(800);
t(!(await overOpen()) && await p.evaluate(() => !!window.__menu.game.me && window.__menu.game.me.alive), '5a. Tekrar Oyna (click) oyunu baslatti');
await kill(); await sleep(2200);
await p.keyboard.press('Enter');
await sleep(800);
t(!(await overOpen()), '5b. Enter ile tekrar baslatma');
await kill(); await sleep(2200);
await p.keyboard.press(' ');
await sleep(800);
t(!(await overOpen()), '5c. Space ile tekrar baslatma');

// K6: ilerleme + market + Esc
await kill(); await sleep(2200);
await p.locator(over('prog')).click();
await sleep(300);
t(await p.evaluate(() => !document.querySelector('#meta [data-prog]').hidden), '6a. Ilerleme acildi');
await p.keyboard.press('Escape');
await sleep(300);
t(await p.evaluate(() => document.querySelector('#meta [data-prog]').hidden), '6b. Esc ilerlemeyi kapatti');
await p.locator(over('shop')).click();
await sleep(300);
t(await p.evaluate(() => !document.querySelector('#meta [data-shop]').hidden), '6c. Market acildi');
await p.keyboard.press('Escape');
await sleep(300);
t(await p.evaluate(() => document.querySelector('#meta [data-shop]').hidden), '6d. Esc marketi kapatti');

// K7: yetersiz coin uyarisi + satin alma (v3 sekmeli market: once sekme secilir)
await p.locator(over('shop')).click();
await sleep(300);
await p.locator('#meta [data-do="tab:boost"]').click();
await sleep(300);
await p.locator('#meta [data-do="buy:boost:xb"]').click();
await sleep(300);
const note = await p.evaluate(() => document.querySelector('#meta .mt-note').textContent);
t(/Yetersiz coin/.test(note), `7a. Yetersiz coinde uyari ("${note}")`);
// 7b: tek olumde yeterli coin icin kutleyi sisir (test duzenegi; uretim degismez)
await p.keyboard.press('Escape'); await sleep(200); // 7a'dan kalan shop modalini kapat
await p.locator(over('retry')).click();
await sleep(800);
await p.evaluate(() => { window.__menu.game.me.mass = 5000; });
await kill(); await sleep(2200);
await p.locator(over('shop')).click(); await sleep(300);
await p.locator('#meta [data-do="tab:fx"]').click(); await sleep(300);
const bakiye = await p.evaluate(() => JSON.parse(localStorage.getItem('snakez.meta')).coins);
await p.locator('#meta [data-do="buy:fx:sparkle"]').click(); await sleep(300);
const buy = await p.evaluate(() => ({
  note: document.querySelector('#meta .mt-note').textContent,
  save: JSON.parse(localStorage.getItem('snakez.meta')),
}));
t(/Satın alındı/.test(buy.note) && buy.save.own.includes('fx:sparkle') && buy.save.eqFx === 'sparkle',
  `7b. Efekt satin alma + otomatik takma (note:"${buy.note}" own:${buy.save.own.join(',')} eqFx:${buy.save.eqFx})`);

// K8: reload sonrasi kalicilik
const before = await p.evaluate(() => localStorage.getItem('snakez.meta'));
await p.reload({ waitUntil: 'load' });
await sleep(4500);
const after = await p.evaluate(() => localStorage.getItem('snakez.meta'));
t(before === after && JSON.parse(after).xp > 0, '8. Reload sonrasi seviye/coin korunuyor');

// K10: tasma (390x844 + 1920x1080, menu + oyun + olum)
for (const vp of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
  const q = await b.newPage({ viewport: vp });
  q.on('pageerror', (e) => errs.push(`tasima pageerror: ${e.message}`));
  await q.goto('http://localhost:5173', { waitUntil: 'load' });
  await sleep(4500);
  const m1 = await q.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await q.locator('[data-name]').fill('T');
  await q.locator('[data-go]').click();
  await sleep(1500);
  const m2 = await q.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await q.evaluate(() => { const g = window.__menu.game; if (g.me && g.me.alive) g.kill(g.me, 0); });
  await sleep(2200);
  const m3 = await q.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  t(m1 <= 1 && m2 <= 1 && m3 <= 1, `10. ${vp.width}x${vp.height} tasma yok (menu:${m1} oyun:${m2} olum:${m3})`);
  await q.close();
}

// K1 build ayrica raporlaniyor; K9 konsol
t(errs.length === 0, `9. Konsolda hata yok${errs.length ? ' -> ' + errs.join(' // ') : ''}`);

console.log(`\n  SONUC: ${total - fail}/${total} gecti`);
await b.close();
process.exit(fail ? 1 : 0);

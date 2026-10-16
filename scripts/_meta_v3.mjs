// Market v3 dogrulamalari: kilitli yuva, showroom, satin alma+takma, oyun-ici
// efekt, isim/cerceve, kalicilik, tasma. Tek kullanimlik.
import { chromium } from 'playwright';
const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0, total = 0;
const t = (c, m) => { total++; console.log((c ? '  [GECTI] ' : '  [KALDI]  ') + m); if (!c) fail++; };
const errs = [];
const GLOW = ['#g'];

const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('http://localhost:5173', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await sleep(4500);

// (1) menude 8 kilitli yuva
const locked = await p.evaluate(() => document.querySelectorAll('.mn-chip.mt-locked').length);
t(locked === 8, `(1) Menude 8 kilitli yuva (${locked})`);
// kilitliye tiklayinca market acilir
await p.locator('.mn-chip.mt-locked').first().click();
await sleep(400);
t(await p.evaluate(() => !document.querySelector('#meta [data-shop]').hidden), '(2a) Kilitli yuvaya tiklayinca market acildi');
await p.keyboard.press('Escape'); await sleep(300);

// OYNA (duz skin)
await p.locator('[data-name]').fill('Test');
await p.locator('.mn-chip:not(.mt-locked)').first().click();
await p.locator('[data-go]').click();
await sleep(1500);
const kill = () => p.evaluate(() => {
  const g = window.__menu.game, me = g.me;
  if (me && me.alive) g.kill(me, 0);
  return !!(me && me.alive === false);
});
const over = (act) => `#meta .mt-over [data-act="${act}"]`;

// (3) showroom: fx kartina hover -> efekt oynuyor
await kill(); await sleep(2200);
await p.locator(over('shop')).click(); await sleep(300);
await p.locator('#meta [data-do="tab:fx"]').click(); await sleep(400);
const px = () => p.evaluate(() => {
  const c = document.querySelector('#meta canvas[data-stage="show"]');
  if (!c || !c.width) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++;
  return n;
});
const p0 = await px();
await p.locator('#meta .mk-card[data-key="fx:ember"]').hover();
await sleep(700);
const p1 = await px();
await sleep(700);
const p2 = await px();
t(p0 >= 0 && p1 > 100 && p1 !== p2, `(3) Showroom'da efekt oynuyor (once:${p0} hover1:${p1} hover2:${p2})`);

// (4) satin alma + otomatik takma (coins icin kutle sisir)
await p.keyboard.press('Escape'); await sleep(200);
await p.locator(over('retry')).click(); await sleep(800);
await p.evaluate(() => { window.__menu.game.me.mass = 5000; });
await kill(); await sleep(2200);
await p.locator(over('shop')).click(); await sleep(300);
await p.locator('#meta [data-do="tab:fx"]').click(); await sleep(300);
await p.locator('#meta [data-do="buy:fx:ember"]').click(); await sleep(300);
const sv1 = await p.evaluate(() => JSON.parse(localStorage.getItem('snakez.meta')));
t(sv1.own.includes('fx:ember') && sv1.eqFx === 'ember', `(4) Satin alma + otomatik takma (own:${sv1.own.join(',')} eqFx:${sv1.eqFx} coin:${sv1.coins})`);

// (5) efekt oyunda ciziliyor; cikarinca kayboluyor
await p.keyboard.press('Escape'); await sleep(200); // shop modalini kapat
// Yilani standart rotada yurut (parcaciklar kat edilen mesafeye gore dogar)
const sur = async () => {
  for (const [x, y] of [[1300, 300], [1600, 700], [900, 750], [700, 300]]) {
    await p.mouse.move(x, y, { steps: 12 }); await sleep(350);
  }
};
await p.locator(over('retry')).click(); await sleep(1200);
await sur();
// (5) efekt oyunda ciziliyor; cikarinca kayboluyor.
// Kamera oyuncuyu ortalar: merkez 300x300 kutuda yilan govdesi (mor) her
// iki kosuda da gorunmeli; turuncu/kirmizi parcak sayisi karsilastirilir.
const mid = () => p.evaluate(() => {
  const c = document.getElementById('g');
  const x = c.getContext('2d');
  const W = c.width, H = c.height, S = 300;
  const d = x.getImageData(W / 2 - S / 2, H / 2 - S / 2, S, S).data;
  let mor = 0, sicak = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    if (a < 40) continue;
    if (b > 200 && r > 100 && r < 220) mor++;
    if ((r > 150 && g > 60 && g < 180 && b < 110) || (r > 170 && g < 110 && b < 110)) sicak++;
  }
  return { mor, sicak };
});
const A = await mid();
await kill(); await sleep(2200);
await p.locator(over('shop')).click(); await sleep(300);
await p.locator('#meta [data-do="tab:fx"]').click(); await sleep(300);
await p.locator('#meta [data-do="off:fx"]').click(); await sleep(300);
const sv2 = await p.evaluate(() => JSON.parse(localStorage.getItem('snakez.meta')));
await p.keyboard.press('Escape'); await sleep(200);
await p.locator(over('retry')).click(); await sleep(1200);
await sur();
const B = await mid();
const cerceveOk = A.mor > 200 && B.mor > 200;
t(cerceveOk && A.sicak > B.sicak && A.sicak > 50,
  `(5) Oyunda efekt var (${A.sicak}) / cikarinca azaldi (${B.sicak}), eqFx:"${sv2.eqFx}"${cerceveOk ? '' : ' [yilan kadrajda degil]'}`);

// (6) isim rengi + cerceve (2. tur coin ile)
await kill(); await sleep(2200);
await p.locator(over('retry')).click(); await sleep(800);
await p.evaluate(() => { window.__menu.game.me.mass = 5000; });
await kill(); await sleep(2200);
await p.locator(over('shop')).click(); await sleep(300);
await p.locator('#meta [data-do="tab:profile"]').click(); await sleep(300);
await p.locator('#meta [data-do="buy:name:cyan"]').click(); await sleep(300);
await p.locator('#meta [data-do="buy:frame:neon"]').click(); await sleep(300);
const sv3 = await p.evaluate(() => JSON.parse(localStorage.getItem('snakez.meta')));
await p.keyboard.press('Escape'); await sleep(200);
await p.locator(over('retry')).click(); await sleep(2000);
const look = await p.evaluate(() => {
  const li = document.querySelector('#meta [data-lb] li.me');
  const ring = document.querySelector('#meta [data-lv] .mt-ring');
  return {
    nc: li ? li.className : 'YOK',
    col: li ? getComputedStyle(li).getPropertyValue('--nc').trim() : '',
    fr: ring ? ring.className : 'YOK',
  };
});
t(sv3.eqName === 'cyan' && /nc/.test(look.nc) && look.col === '#2be7ff', `(6a) Isim rengi liderlikte (li:"${look.nc}" --nc:${look.col})`);
t(sv3.eqFrame === 'neon' && /fr-neon/.test(look.fr), `(6b) Cerceve rozette (ring:"${look.fr}")`);

// (7) reload sonrasi sahiplik
const svBefore = await p.evaluate(() => localStorage.getItem('snakez.meta'));
await p.reload({ waitUntil: 'load' });
await sleep(4500);
const svAfter = await p.evaluate(() => JSON.parse(localStorage.getItem('snakez.meta')));
t(svAfter.own.includes('fx:ember') && svAfter.eqName === 'cyan' && svAfter.eqFrame === 'neon',
  `(7) Reload sonrasi sahiplik (own:${svAfter.own.length} urun eqName:${svAfter.eqName} eqFrame:${svAfter.eqFrame})`);
await p.close();

/* (8)+(9): Esc + 390x844 tasma */
{
  const q = await b.newPage({ viewport: { width: 390, height: 844 } });
  q.on('pageerror', (e) => errs.push('390 pageerror: ' + e.message));
  await q.goto('http://localhost:5173', { waitUntil: 'load' });
  await sleep(4500);
  await q.locator('#meta .mt-pf [data-act="shop"]').click();
  await sleep(400);
  const open = await q.evaluate(() => !document.querySelector('#meta [data-shop]').hidden);
  const over2 = await q.evaluate(() => {
    const m = document.querySelector('#meta [data-shop] .mt-card');
    if (!m) return -1;
    const r = m.getBoundingClientRect();
    return Math.max(0, r.right - window.innerWidth, -r.left, r.bottom - window.innerHeight, -r.top);
  });
  await q.keyboard.press('Escape'); await sleep(300);
  const closed = await q.evaluate(() => document.querySelector('#meta [data-shop]').hidden);
  t(open && closed, '(8) 390px market acildi + Esc kapatti');
  t(over2 <= 1, `(9) 390x844 market tasmasi ${over2}px`);
  await q.close();
}

t(errs.length === 0, `Konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
console.log(`\n  SONUC: ${total - fail}/${total} gecti`);
await b.close();
process.exit(fail ? 1 : 0);

// Yeni arayuz dogrulamalari: .mt-pf cipi, cipten market, canli XP, cakisma.
// Tek kullanimlik; beklenti degisiklikleri raporda gerekceli.
import { chromium } from 'playwright';
const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0, total = 0;
const t = (c, m) => { total++; console.log((c ? '  [GECTI] ' : '  [KALDI]  ') + m); if (!c) fail++; };
const errs = [];

/* (1) + (2): menude cip -> market -> Esc -> Enter */
{
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' });
  await sleep(4500);

  t(await p.evaluate(() => !document.querySelector('#meta .mt-pf').hidden), '(1a) Menude .mt-pf gorunur');
  const pfTxt = await p.evaluate(() => document.querySelector('#meta .mt-pf').textContent.length);
  t(pfTxt > 5, `(1b) Cipte seviye/coin icerigi var (${pfTxt}ch)`);

  // Cipteki MARKET butonu (pf-id) marketi acar
  const shopBtn = await p.evaluate(() => !!document.querySelector('#meta .mt-pf [data-act="shop"]'));
  t(shopBtn, '(2a) Cipte MARKET butonu var');
  if (shopBtn) await p.locator('#meta .mt-pf [data-act="shop"]').click();
  await sleep(300);
  t(await p.evaluate(() => !document.querySelector('#meta [data-shop]').hidden), '(2b) MARKET cipten acildi');
  await p.keyboard.press('Escape');
  await sleep(300);
  t(await p.evaluate(() => document.querySelector('#meta [data-shop]').hidden), '(2c) Esc marketi kapatti');

  // Market acikken Enter oyunu baslatmamali
  if (shopBtn) await p.locator('#meta .mt-pf [data-act="shop"]').click();
  await sleep(300);
  await p.evaluate(() => document.body.focus());
  await p.keyboard.press('Enter');
  await sleep(800);
  const st = await p.evaluate(() => ({ me: !!window.__menu.game.me, menu: !document.querySelector('.mn').hidden }));
  t(!st.me && st.menu, '(2d) Market acikken Enter oyunu baslatmadi (menude kalindi)');
  await p.close();
}

/* (1c) + (3): OYNA sonrasi cip gizli, canli XP artiyor */
{
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await sleep(4500);
  await p.locator('[data-name]').fill('Test');
  await p.locator('[data-go]').click();
  await sleep(1500);
  t(await p.evaluate(() => document.querySelector('#meta .mt-pf').hidden), '(1c) OYNA sonrasi .mt-pf gizli');

  const r1 = await p.evaluate(() => ({
    run: document.querySelector('#meta [data-run]').textContent,
    xpt: document.querySelector('#meta [data-xpt]').textContent,
    bar: document.querySelector('#meta [data-lv] [data-bar]').style.width,
  }));
  await sleep(4000);
  const r2 = await p.evaluate(() => ({
    run: document.querySelector('#meta [data-run]').textContent,
    xpt: document.querySelector('#meta [data-xpt]').textContent,
    bar: document.querySelector('#meta [data-lv] [data-bar]').style.width,
  }));
  const num = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;
  t(num(r2.run) > num(r1.run), `(3a) [data-run] artiyor ("${r1.run}" -> "${r2.run}")`);
  t(r1.xpt !== r2.xpt || r1.bar !== r2.bar, `(3b) XP cubugu/metin canli ("${r1.xpt}" ${r1.bar} -> "${r2.xpt}" ${r2.bar})`);
  await p.close();
}

/* (5): cip cakisma olcumu — rapor amaçli, duzeltme yok */
for (const vp of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await sleep(4500);
  const res = await p.evaluate(() => {
    const R = (s) => {
      const e = document.querySelector(s);
      return e && getComputedStyle(e).display !== 'none' && e.offsetHeight > 0 ? e.getBoundingClientRect() : null;
    };
    const ov = (a, c) => a && c
      ? Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left)) *
        Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top)) : 0;
    const pf = R('#meta .mt-pf');
    const out = { pf: pf ? [pf.x, pf.y, pf.right, pf.bottom].map(Math.round) : null, hits: [] };
    for (const s of ['.mn-brand', '.mn-copy', '.mn-deck', '.mn-board', '.mn-tele', '.mn-keys', '.mn-go']) {
      const v = ov(pf, R(s));
      if (v > 0) out.hits.push(`${s}:${Math.round(v)}px2`);
    }
    return out;
  });
  const ok = res.hits.length === 0;
  t(ok, `(5) ${vp.width}x${vp.height} cip ${res.pf ? JSON.stringify(res.pf) : 'YOK'} cakisma:${res.hits.length ? res.hits.join(' ') : 'yok'}`);
  await p.close();
}

t(errs.length === 0, `Konsolda hata yok${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
console.log(`\n  SONUC: ${total - fail}/${total} gecti`);
await b.close();
process.exit(fail ? 1 : 0);

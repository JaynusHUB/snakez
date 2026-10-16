import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
let fail = 0, total = 0;
const t = (c, m) => { total++; console.log((c ? '  [GECTI] ' : '  [KALDI]  ') + m); if (!c) fail++; };
const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5173', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await sleep(4000);
// kalite + fps secimi
await p.locator('[data-gear]').click();
await sleep(400);
await p.locator('[data-q="low"]').click();
await sleep(200);
await p.locator('[data-fps]').click();
await sleep(200);
let s = await p.evaluate(() => ({
  q: localStorage.getItem('snakez.quality'),
  dq: document.documentElement.dataset.q,
  f: localStorage.getItem('snakez.fps'),
  fpsAria: document.querySelector('[data-fps]').getAttribute('aria-checked'),
}));
t(s.q === 'low' && s.dq === 'low' && s.f === '1' && s.fpsAria === 'true',
  `kalite+fps kaydedildi (q:${s.q}, data-q:${s.dq}, fps:${s.f}, switch:${s.fpsAria})`);
const checked = await p.evaluate(() => document.querySelector('#menu [data-q="low"]').getAttribute('aria-checked'));
const allQ = await p.evaluate(() => [...document.querySelectorAll('#menu [data-q]')].map((e) => `${e.getAttribute('data-q')}=${e.getAttribute('aria-checked')}`).join(','));
t(checked === 'true', `Dusuk secili (${checked} / ${allQ})`);
// FPS sayaci menude de gorunur + sag ustte
const m0 = await p.evaluate(() => {
  const el = document.querySelector('[data-fpsmeter]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { t: el.textContent, vis: !el.hidden, right: Math.round(r.right), top: Math.round(r.top) };
});
t(!!m0 && m0.vis && m0.right > 1800 && m0.top < 60, `sayac menude sag ustte (${JSON.stringify(m0)})`);
await p.locator('[data-setclose]').click();
await sleep(200);
// oyuna gir: sayaç gorunmeye devam etmeli
await p.locator('[data-name]').fill('Test');
await p.locator('[data-go]').click();
await sleep(2000);
const m1 = await p.evaluate(() => {
  const el = document.querySelector('[data-fpsmeter]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { t: el.textContent, vis: !el.hidden, right: Math.round(r.right), top: Math.round(r.top) };
});
t(!!m1 && m1.vis && /^\d+ FPS$/.test(m1.t || '') && m1.right > 1800, `sayac oyunda sag ustte (${JSON.stringify(m1)})`);
await p.screenshot({ path: 'shots/kalite_dusuk.png' });
// Oyun-ici Esc ayar paneli
await p.keyboard.press('Escape');
await sleep(400);
t(await p.evaluate(() => !!document.querySelector('#meta [data-set]') && !document.querySelector('#meta [data-set]').hidden), 'oyun-ici Esc paneli acildi');
const inGame = await p.evaluate(() => ({
  fx: [...document.querySelectorAll('#meta [data-setopt^="fx:"]')].map((e) => e.getAttribute('aria-checked')).join(','),
  q: [...document.querySelectorAll('#meta [data-setopt^="q:"]')].map((e) => e.getAttribute('aria-checked')).join(','),
}));
t(inGame.fx === 'true,false,false' && inGame.q === 'true,false,false', `oyun-ici panel secimleri (fx:${inGame.fx} q:${inGame.q})`);
await p.locator('#meta [data-setopt="q:med"]').click();
await sleep(200);
const qm = await p.evaluate(() => ({ q: localStorage.getItem('snakez.quality'), dq: document.documentElement.dataset.q }));
t(qm.q === 'med' && qm.dq === 'med', `oyun-ici kalite degisimi uygulandi (${qm.q})`);
await p.keyboard.press('Escape');
await sleep(300);
t(await p.evaluate(() => document.querySelector('#meta [data-set]').hidden), 'oyun-ici Esc kapatti');
// reload: ayarlar korunur, sayac menude gorunur
await p.reload({ waitUntil: 'load' });
await sleep(4000);
const m2 = await p.evaluate(() => ({
  q: localStorage.getItem('snakez.quality'),
  vis: (() => { const el = document.querySelector('[data-fpsmeter]'); return !!el && !el.hidden; })(),
}));
t(m2.q === 'med' && m2.vis, 'reload sonrasi kalite korunur, menude sayac gorunur');
t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
await p.close();
console.log(fail === 0 ? '  TUMU GECTI' : `  ${fail}/${total} KALDI`);
await b.close();
process.exit(fail ? 1 : 0);

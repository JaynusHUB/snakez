import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
let fail = 0, total = 0;
const t = (c, m) => { total++; console.log((c ? '  [GECTI] ' : '  [KALDI]  ') + m); if (!c) fail++; };

// Matris: OS ayari x mod
for (const [rm, mode, wantCalm] of [
  ['reduce', 'auto', true],
  ['reduce', 'on', false],
  ['reduce', 'off', true],
  ['no-preference', 'auto', false],
  ['no-preference', 'off', true],
  ['no-preference', 'on', false],
]) {
  const p = await b.newPage({ viewport: { width: 1920, height: 950 }, reducedMotion: rm });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate((m) => localStorage.setItem('snakez.fx', m), mode);
  await p.reload({ waitUntil: 'load' });
  await sleep(3500);
  const s = await p.evaluate(() => ({
    calm: document.documentElement.classList.contains('fx-calm'),
    ds: document.documentElement.dataset.fx,
    scan: getComputedStyle(document.querySelector('.mn-scan')).display,
  }));
  t(s.calm === wantCalm && s.ds === mode,
    `${rm}/${mode} -> fx-calm:${s.calm} (beklenen ${wantCalm}), dataset:${s.ds}`);
  if (rm === 'reduce' && mode === 'on') {
    t(s.scan !== 'none', 'reduce+acik: tarama seridi gorunur (efekt calisiyor)');
  }
  await p.close();
}

// Arayuz: disli + modal + secim + kalicilik + Esc + Space + backdrop + logo
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  const gearBox = await p.locator('[data-gear]').boundingBox();
  t(!!gearBox && gearBox.width >= 36, `disli butonu gorunur (${gearBox ? Math.round(gearBox.width) + 'px' : 'yok'})`);
  await p.screenshot({ path: 'shots/ayar_disli.png', clip: { x: gearBox.x - 60, y: gearBox.y - 20, width: gearBox.width + 120, height: gearBox.height + 40 } });
  await p.locator('[data-gear]').click();
  await sleep(400);
  t(await p.evaluate(() => !document.querySelector('[data-set]').hidden), 'modal acildi');
  const checked = await p.evaluate(() => [...document.querySelectorAll('[data-fxopt]')].map((e) => e.getAttribute('aria-checked')).join(','));
  t(checked === 'true,false,false', `varsayilan Otomatik secili (${checked})`);
  await p.screenshot({ path: 'shots/ayar_modal.png' });
  await p.locator('[data-fxopt="off"]').click();
  await sleep(300);
  const st = await p.evaluate(() => ({
    mode: localStorage.getItem('snakez.fx'),
    calm: document.documentElement.classList.contains('fx-calm'),
    checked: [...document.querySelectorAll('[data-fxopt]')].map((e) => e.getAttribute('aria-checked')).join(','),
  }));
  t(st.mode === 'off' && st.calm && st.checked === 'false,false,true', 'Kapali secildi + kaydedildi + calm uygulandi');
  // Logo neonu efekt anahtarından bağımsız: Kapalı'da da oynar (bilinçli karar).
  const logo = await p.evaluate(() => {
    const svg = document.querySelector('.mn-logo svg');
    return svg ? { paused: svg.animationsPaused(), rectHidden: svg.querySelector('rect')?.style.visibility === 'hidden' } : null;
  });
  t(!!logo && !logo.paused && !logo.rectHidden, `logo neonu bagimsiz (paused:${logo?.paused}, gizli:${logo?.rectHidden})`);
  // Space modal odaktayken oyunu baslatmamali
  await p.keyboard.press(' ');
  await sleep(600);
  t(await p.evaluate(() => !document.querySelector('[data-set]').hidden && !!window.__menu.game && window.__menu.game.me === null), 'Space modaldayken oyunu baslatmadi');
  await p.keyboard.press('Escape');
  await sleep(300);
  t(await p.evaluate(() => document.querySelector('[data-set]').hidden), 'Esc kapatti');
  // Backdrop: disari tiklayinca kapanmali
  await p.locator('[data-gear]').click();
  await sleep(400);
  await p.mouse.click(30, 30);
  await sleep(300);
  t(await p.evaluate(() => document.querySelector('[data-set]').hidden), 'disari tiklayinca kapandi');
  // kalicilik
  await p.reload({ waitUntil: 'load' });
  await sleep(3500);
  t(await p.evaluate(() => localStorage.getItem('snakez.fx') === 'off' && document.documentElement.classList.contains('fx-calm')), 'yeniden yuklemede korunuyor');
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}
console.log(fail === 0 ? '  TUMU GECTI' : `  ${fail}/${total} KALDI`);
await b.close();
process.exit(fail ? 1 : 0);

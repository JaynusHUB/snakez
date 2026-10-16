// Playwright dogrulama dongusu — develop-web-game skill'inin istedigi cekirdek.
//
// Skill'in hazir istemcisi bu makinede kurulu degil
// ($CODEX_HOME/skills/develop-web-game yok). Skill "unless required"
// dedigi icin karsiligi bu dosya. Skill'in belirttigi dort cikti:
//   1. ekran goruntuleri (her burst sonrasi)
//   2. render_game_to_text JSON durumu
//   3. konsol hatalari (ilk yeni hata once)
//   4. advanceTime ile deterministik kare adimlari
//
// Kullanim:
//   node scripts/verify.mjs                      -> tum senaryolar
//   node scripts/verify.mjs --only menu          -> tek senaryo
//   node scripts/verify.mjs --headed             -> gorunur pencere
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Kancalar (render_game_to_text/advanceTime/__menu) yalnizca DEV sunucusunda
// aciktir (denetim B1); bu yuzden varsayilan hedef dev sunucusudur.
// Farkli port icin: URL=http://localhost:PORT node scripts/verify.mjs
const URL = process.env.URL ?? 'http://localhost:5173';
const OUT = 'test-shots';
const HEADED = process.argv.includes('--headed');
const ONLY = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small', width: 320, height: 568 },
];

/** Konsol hatalarini toplayan tampon. */
function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.startsWith('data:')) errors.push(`requestfailed: ${u} ${r.failure()?.errorText ?? ''}`);
  });
  return errors;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function state(page) {
  return page.evaluate(() =>
    typeof window.render_game_to_text === 'function'
      ? JSON.parse(window.render_game_to_text())
      : { hata: 'render_game_to_text yok' });
}

/**
 * develop-web-game: "Exhaustively exercise all important interactions.
 * For each, think through the full multi-step sequence it implies."
 * Asagidaki her senaryo tam zinciri dener: menu -> isim -> skin -> oyna ->
 * oyun -> olum -> istatistik -> reload.
 */
async function menuFlow(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(page);
  // develop-web-game "Reset between scenarios": depoyu temizle, SONRA
  // yeniden yukle. evaluate + reload ayri ayri calisiyordu ve evaluate
  // sonrasi execution context yok oluyordu.
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.mn-go', { timeout: 8000 });
  await sleep(700);

  const open = await state(page);
  if (open.mode !== 'idle') errs.push(`menu: mode '${open.mode}' olmali 'idle'`);
  const chips = await page.locator('.mn-chip').count();
  if (chips < 15) errs.push(`menu: ${chips} skin yuvasi, en az 15 bekleniyor`);

  await page.screenshot({ path: `${OUT}/01-menu.png` });

  // Cakisma denetimi: her cift gercek metin kutusu
  const overlap = await page.evaluate(() => {
    const R = (s) => {
      const e = document.querySelector(s);
      return e && getComputedStyle(e).display !== 'none' ? e.getBoundingClientRect() : null;
    };
    const ov = (a, b) =>
      a && b
        ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
        : 0;
    const pairs = [
      ['.mn-go', '.mn-keys'], ['.mn-tele', '.mn-strip'], ['.mn-head', '.mn-deck'],
      ['.mn-brand', '.mn-head'], ['.mn-go', '.mn-tele'], ['.mn-tele', '.mn-keys'],
    ];
    return pairs.map(([x, y]) => `${x}x${y}=${Math.round(ov(R(x), R(y)))}`).join(' ');
  });
  for (const m of overlap.matchAll(/(\.[\w-]+x\.[\w-]+)=(\d+)/g)) {
    if (Number(m[2]) > 0) errs.push(`cakisma ${m[1]}: ${m[2]}px2`);
  }

  // Skin secimi -> vitrine + localStorage
  await page.locator('.mn-chip').nth(12).click();
  await sleep(400);
  const skin = await page.evaluate(() => localStorage.getItem('snakez.skin'));
  if (skin !== '12') errs.push(`skin: localStorage '${skin}', '12' bekleniyordu`);
  const sel = await page.locator('.mn-chip[data-on="1"]').count();
  if (sel !== 1) errs.push(`skin: ${sel} secili yuva, 1 bekleniyordu`);

  // Klavye ile gezinme
  await page.locator('.mn-chip[data-on="1"]').focus();
  await page.keyboard.press('ArrowRight');
  await sleep(250);
  const skin2 = await page.evaluate(() => localStorage.getItem('snakez.skin'));
  if (skin2 !== '13') errs.push(`klavye: skin '${skin2}', '13' bekleniyordu`);

  // Isim + Enter ile OYNA
  await page.fill('[data-name]', '  Test   Oyuncu  ');
  await page.press('[data-name]', 'Enter');
  await sleep(500);
  const playing = await state(page);
  if (playing.mode !== 'play') errs.push(`oyna: mode '${playing.mode}'`);
  const saved = await page.evaluate(() => localStorage.getItem('snakez.name'));
  if (saved !== 'Test Oyuncu') errs.push(`isim: '${saved}', 'Test Oyuncu' olmali (temizlenmedi)`);
  const bbVisible = await page.evaluate(() => !document.getElementById('bb').hasAttribute('hidden'));
  if (!bbVisible) errs.push('oyna: mobil boost butonu gorunur olmali');

  await page.screenshot({ path: `${OUT}/02-play.png` });

  // Oyuncu gercekten hareket ediyor mu
  const p1 = (await state(page)).player;
  await sleep(700);
  const p2 = (await state(page)).player;
  const moved = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y) : 0;
  if (moved < 20) errs.push(`oyun: oyuncu 700ms'de ${moved.toFixed(1)}px yer degistirdi (beklenen >20)`);

  // Olum -> olum ekrani (advanceTime deterministik)
  // NOT (Meta entegrasyonu): oyuncu olumunde otomatik replay() YOKTUR;
  // Game.onDeath atanmisken yeniden baslatmayi arayuz (olum ekrani) yapar.
  // Bu yuzden eski snakez.best/games + menuye donus beklentisi gecerli degil;
  // istatistik snakez.meta'da (runs/xp) yasar.
  await page.evaluate(() => window.advanceTime(60000));
  await sleep(2400);
  await page.evaluate(() => window.advanceTime(60000));
  await sleep(2400);
  const over = await page.evaluate(() => !document.querySelector('#meta .mt-over').hidden);
  if (!over) errs.push('olum: olum ekrani acilmadi (Meta onDeath calismadi?)');
  const st = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('snakez.meta') || 'null'); } catch { return null; }
  });
  if (!st || !(st.runs >= 1)) errs.push(`olum: snakez.meta runs='${st && st.runs}' (en az 1 olmali)`);
  if (!st || !(st.xp > 0)) errs.push(`olum: snakez.meta xp='${st && st.xp}' (0'dan buyuk olmali)`);
  // Tekrar Oyna -> oyun kaldigi yerden degil, yeni hayatla devam etmeli
  await page.locator('#meta [data-act="retry"]').click();
  await sleep(800);
  const alive = await page.evaluate(() => { const g = window.__menu.game; return !!(g.me && g.me.alive); });
  if (!alive) errs.push('olum: Tekrar Oyna sonrasi oyuncu canli degil');

  // Olum ekrani -> Menu: son tur menu istatistigine yazilir (meta.ts commitRun),
  // sonra sayfa yenilenir. Mevcut beklentiler korunur, bu dogrulama eklenir.
  await page.evaluate(() => { const g = window.__menu.game; if (g.me && g.me.alive) g.kill(g.me, 0); });
  await sleep(2400);
  const overAgain = await page.evaluate(() => !document.querySelector('#meta .mt-over').hidden);
  if (!overAgain) errs.push('reload: ikinci olumde olum ekrani acilmadi');
  await page.locator('#meta [data-act="menu"]').click();
  await page.waitForLoadState('load');
  await page.waitForSelector('.mn-go');
  await sleep(500);
  const shown = {
    best: await page.locator('[data-best]').textContent(),
    games: await page.locator('[data-games]').textContent(),
  };
  if (!Number(String(shown.best).replace(/\D/g, ''))) errs.push('reload: REKOR gosterilmiyor (olum->Menu commitRun calismadi?)');
  if (!Number(String(shown.games).replace(/\D/g, ''))) errs.push('reload: OYUN gosterilmiyor (olum->Menu commitRun calismadi?)');
  // Yeniden yukleme sonrasi korunuyor mu (isim + Meta ilerlemesi)
  // (reload yerine goto: evaluate icin execution context'in garanti edilmesi)
  const savedName = await page.evaluate(() => localStorage.getItem('snakez.name'));
  if (savedName !== 'Test Oyuncu') errs.push(`reload: isim korunmadi ('${savedName}')`);
  const metaKept = await page.evaluate(() => {
    try { const m = JSON.parse(localStorage.getItem('snakez.meta') || 'null'); return !!(m && m.runs >= 1 && m.xp > 0); }
    catch { return false; }
  });
  if (!metaKept) errs.push('reload: snakez.meta (seviye/coin) korunmadi');
  await page.screenshot({ path: `${OUT}/03-reload.png` });

  await page.close();
  errors.push(...errs);
}

/** Mobil akis: gercek viewport, cift dokunma, yatay kaydirma. */
async function mobileFlow(browser, errors) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const errs = watchErrors(page);
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.mn-go');
  await sleep(900);

  const go = await page.locator('.mn-go').boundingBox();
  if (!go || go.height < 44) errs.push(`mobil: OYNA yuksekligi ${go?.height ?? 0}px (<44)`);
  // Not: input'un class'i yok; `data-name` ozniteligi ile secilir.
  const name = await page.locator('[data-name]').boundingBox();
  if (!name || name.height < 44) errs.push(`mobil: isim alani ${name?.height ?? 0}px (<44)`);

  const scroll = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth,
  }));
  if (scroll.w > scroll.vw + 1) errs.push(`mobil: yatay tasma ${scroll.w}>${scroll.vw}`);

  // Skin seridi yatay kaydirilabiliyor mu
  const stripScrollable = await page.evaluate(() => {
    const s = document.querySelector('.mn-strip');
    return s.scrollWidth > s.clientWidth + 2;
  });
  if (!stripScrollable) errs.push('mobil: skin seridi kaydirilamiyor (15 yuva sigmiyor)');

  await page.screenshot({ path: `${OUT}/04-mobile-menu.png` });

  // Dokunarak OYNA
  await page.locator('.mn-go').tap();
  await sleep(500);
  const st = await state(page);
  if (st.mode !== 'play') errs.push(`mobil: tap ile oyun baslamadi (mode '${st.mode}')`);
  await page.screenshot({ path: `${OUT}/05-mobile-play.png` });

  await page.close();
  errors.push(...errs);
}

/** Her viewport'ta yerlesim sagligi. */
async function layoutSweep(browser, errors) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errs = watchErrors(page);
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('.mn-go');
    await sleep(800);

    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const R = (s) => {
        const e = q(s);
        return e && getComputedStyle(e).display !== 'none' ? e.getBoundingClientRect() : null;
      };
      const ov = (a, b) =>
        a && b
          ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
          : 0;
      const go = R('.mn-go');
      return {
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        goH: go ? Math.round(go.height) : 0,
        deckBottom: Math.round(R('.mn-deck')?.bottom ?? 0),
        vh: document.documentElement.clientHeight,
        overlap: {
          goKeys: Math.round(ov(R('.mn-go'), R('.mn-keys'))),
          teleStrip: Math.round(ov(R('.mn-tele'), R('.mn-strip'))),
          headDeck: Math.round(ov(R('.mn-head'), R('.mn-deck'))),
        },
      };
    });

    if (r.overflowX) errs.push(`${vp.name}: yatay tasma`);
    if (r.goH < 44) errs.push(`${vp.name}: OYNA ${r.goH}px (<44)`);
    if (r.deckBottom > r.vh + 1) errs.push(`${vp.name}: band ekrandan tasiyor (${r.deckBottom}>${r.vh})`);
    for (const [k, v] of Object.entries(r.overlap)) {
      if (v > 0) errs.push(`${vp.name}: cakisma ${k} = ${v}px2`);
    }
    await page.screenshot({ path: `${OUT}/vp-${vp.name}.png` });
    await page.close();
    errors.push(...errs);
  }
}

async function main() {
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: !HEADED });
  const errors = [];

  const scenarios = [
    ['menu', menuFlow],
    ['mobile', mobileFlow],
    ['layout', layoutSweep],
  ];

  for (const [name, fn] of scenarios) {
    if (ONLY && ONLY !== name) continue;
    const before = errors.length;
    try {
      await fn(browser, errors);
    } catch (e) {
      errors.push(`${name}: ISTISNA ${e.message}`);
    }
    const added = errors.length - before;
    console.log(`${added === 0 ? 'OK  ' : 'FAIL'} ${name}${added ? ` (${added} sorun)` : ''}`);
  }

  await browser.close();

  await writeFile(
    `${OUT}/report.json`,
    JSON.stringify({ url: URL, zaman: new Date().toISOString(), hatalar: errors }, null, 2),
  );

  if (errors.length) {
    console.log(`\n${errors.length} sorun:`);
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log('\nHata yok.');
  }
}

main();

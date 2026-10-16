import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
let fail = 0, total = 0;
const t = (c, m) => { total++; console.log((c ? '  [GECTI] ' : '  [KALDI]  ') + m); if (!c) fail++; };
const pad = (n) => String(n).padStart(2, '0');
const day = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const yest = day(new Date(Date.now() - 86400000));
const morrow = day(new Date(Date.now() + 86400000));
const META = { xp: 0, coins: 0, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' };
// Bekleme yöntemi: AÇ sonrası data-phase="done" beklenir (koreografi ~1.8sn).
const waitDone = (p) => p.locator('.mt-card.ch[data-phase="done"]').waitFor({ timeout: 4000 });

// --- Dal 1: zorla coin (r=50) + perdeler ---
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.5; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 0, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' })); });
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  t(await p.evaluate(() => !!document.querySelector('.pf-chest.ready')), 'sandik butonu hazir (parliyor)');
  await p.locator('.pf-chest').click();
  await sleep(400);
  t(await p.evaluate(() => !document.querySelector('#meta [data-chest]').hidden), 'sandik modali acildi');
  await p.screenshot({ path: 'shots/sandik_kapali.png' });
  const odds = await p.evaluate(() => ({
    rows: [...document.querySelectorAll('#meta [data-chest] .ch-odd')].map((e) => e.textContent?.replace(/\s+/g, ' ').trim()),
    note: document.querySelector('#meta [data-chest] .ch-odds-n')?.textContent,
    poolCount: document.querySelectorAll('#meta [data-chest] .ch-pool li').length,
  }));
  t(odds.rows.length === 7 && /%62/.test(odds.rows[0] || '') && /%10/.test(odds.rows[1] || '') && /%0,5/.test(odds.rows[2] || '') && /%5/.test(odds.rows[3] || '') && /%3/.test(odds.rows[4] || '') && /%2,3/.test(odds.rows[5] || '') && /%1,2/.test(odds.rows[6] || ''),
    `olasilik tablosu (${(odds.rows || []).join(' | ')})`);
  t(/80 coin/.test(odds.note || '') && odds.poolCount === 14, `teselli notu + havuz (${odds.poolCount} urun)`);
  await p.locator('#meta [data-chest] .ch-pool summary').click();
  await sleep(200);
  await p.screenshot({ path: 'shots/sandik_havuz.png' });
  const c0 = await p.evaluate(() => JSON.parse(localStorage.getItem('snakez.meta')).coins);
  await p.locator('[data-chest-open]').click();
  await sleep(400);
  t(await p.evaluate(() => document.querySelector('.mt-card.ch')?.dataset.phase === 'tension'), 'faz: tension');
  await p.screenshot({ path: 'shots/sandik_gerilim.png' });
  await sleep(500);
  await p.screenshot({ path: 'shots/sandik_patlama.png' });
  await sleep(500);
  await p.screenshot({ path: 'shots/sandik_reveal.png' });
  await waitDone(p);
  t(true, 'faz: done ulasti');
  const r = await p.evaluate(() => ({
    label: document.querySelector('.ch-got')?.textContent,
    open: !!document.querySelector('.ch-box.open'),
    coins: JSON.parse(localStorage.getItem('snakez.meta')).coins,
    last: JSON.parse(localStorage.getItem('snakez.chest')).last,
    streak: JSON.parse(localStorage.getItem('snakez.chest')).streak,
    noStreakBadge: !document.querySelector('.ch-streak'),
  }));
  t(r.open && /Coin$/.test(r.label || '') && r.coins > c0, `coin odulu uygulandi (${r.label}, ${c0}->${r.coins})`);
  t(r.last === day() && r.streak === 1, `durum kaydedildi (gun:${r.last}, seri:${r.streak})`);
  t(r.noStreakBadge, 'seri<3: rozet yok');
  await p.screenshot({ path: 'shots/sandik_acik.png' });
  // ikinci acilis: bekleme gorunumu, AC yok
  await p.locator('#meta [data-chest] [data-close]').first().click();
  await sleep(300);
  await p.locator('.pf-chest').click();
  await sleep(400);
  const w = await p.evaluate(() => ({
    noOpen: !document.querySelector('#meta [data-chest]:not([hidden]) [data-chest-open]'),
    txt: document.querySelector('#meta [data-chest] .ch-sub')?.textContent,
    readyCls: document.querySelector('.pf-chest.ready'),
  }));
  t(w.noOpen && /Sonraki sandık/.test(w.txt || '') && !w.readyCls, `bekleme gorunumu (${w.txt})`);
  await p.keyboard.press('Escape');
  await sleep(300);
  t(await p.evaluate(() => document.querySelector('#meta [data-chest]').hidden), 'Esc kapatti');
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}

// --- Dal 2: ozel urun cyan (r=80 nadir + sub=cyan), ertesi gun seri + rozet ---
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.8; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate((y) => {
    localStorage.clear();
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 0, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' }));
    localStorage.setItem('snakez.chest', JSON.stringify({ last: y, streak: 3 }));
  }, yest);
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  await p.locator('.pf-chest').click();
  await sleep(400);
  await p.locator('[data-chest-open]').click();
  await waitDone(p);
  const r = await p.evaluate(() => ({
    label: document.querySelector('.ch-got')?.textContent,
    own: JSON.parse(localStorage.getItem('snakez.meta')).own,
    streak: JSON.parse(localStorage.getItem('snakez.chest')).streak,
    rar: document.querySelector('.ch-rar')?.textContent,
    badge: document.querySelector('.ch-streak')?.textContent,
  }));
  t(r.own.length === 1 && r.own[0] === 'fx:frost' && r.label === 'Buz Kristali', `nadir frost dustu (${r.label})`);
  t(r.streak === 4, `seri artti (3->${r.streak})`);
  t(r.rar === 'NADİR' && r.badge === 'SERİ x4', `rarity + seri rozeti (${r.rar} / ${r.badge})`);
  await p.screenshot({ path: 'shots/sandik_nadir.png' });
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}

// --- Dal 3: havuz bosken teselli 80 coin (r=80 nadir, havuz bos) ---
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.8; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    const keys = ['skin:krampus', 'skin:werewolf', 'fx:sparkle', 'fx:ember', 'fx:frost', 'fx:toxic', 'fx:neon',
      'name:cyan', 'name:lime', 'name:pink', 'name:gold', 'frame:neon', 'frame:gold', 'frame:orbit', 'frame:snake', 'frame:ice'];
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 10, xb: 0, cb: 0, runs: 0, own: keys, eqFx: '', eqName: '', eqFrame: '' }));
    localStorage.removeItem('snakez.chest');
  });
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  await p.locator('.pf-chest').click();
  await sleep(400);
  await p.locator('[data-chest-open]').click();
  await waitDone(p);
  const r = await p.evaluate(() => ({
    label: document.querySelector('.ch-got')?.textContent,
    coins: JSON.parse(localStorage.getItem('snakez.meta')).coins,
  }));
  t(r.label === '80 Coin' && r.coins === 90, `havuz bosken teselli 80 (${r.label}, coin:${r.coins})`);
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}

// --- Dal 4: epik (havuzda tek epik) + shake + mor tema ---
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.75; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    const keys = ['skin:krampus', 'skin:werewolf', 'fx:sparkle', 'fx:ember', 'fx:frost', 'fx:toxic',
      'name:cyan', 'name:lime', 'name:pink', 'name:gold', 'frame:neon', 'frame:gold', 'frame:snake'];
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 0, xb: 0, cb: 0, runs: 0, own: keys, eqFx: '', eqName: '', eqFrame: '' }));
    localStorage.removeItem('snakez.chest');
  });
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  await p.locator('.pf-chest').click();
  await sleep(400);
  await p.locator('[data-chest-open]').click();
  await sleep(1300);
  await p.screenshot({ path: 'shots/sandik_epik.png' });
  await waitDone(p);
  const r = await p.evaluate(() => ({
    label: document.querySelector('.ch-got')?.textContent,
    rar: document.querySelector('.ch-rar')?.textContent,
    rc: getComputedStyle(document.querySelector('.mt-card.ch')).getPropertyValue('--rc').trim(),
  }));
  t(r.rar === 'EPİK' && r.rc === '#b46bff', `epik tema (${r.label} / ${r.rar} / ${r.rc})`);
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}

// --- Dal 5: calm (efekt Kapali) = aninda statik sonuc ---
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.5; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snakez.fx', 'off');
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 0, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' }));
  });
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  await p.locator('.pf-chest').click();
  await sleep(400);
  await p.locator('[data-chest-open]').click();
  await sleep(300);
  const r = await p.evaluate(() => ({
    phase: document.querySelector('.mt-card.ch')?.dataset.phase,
    label: document.querySelector('.ch-got')?.textContent,
    open: !!document.querySelector('.ch-box.open'),
    anim: getComputedStyle(document.querySelector('.ch-rays')).animationName,
  }));
  t(r.phase === 'done' && r.open && /Coin$/.test(r.label || ''), `calm: aninda sonuc (${r.label})`);
  t(r.anim === 'none', 'calm: isin animasyonu yok');
  await p.screenshot({ path: 'shots/sandik_calm.png' });
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}

// --- Dal 6: ortada kapatma + skip + ileri tarih + bozuk kayit ---
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.5; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 5, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' }));
  });
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  // ortada Esc: odul verilmis olmali (once-kaydet), modal kapanmali
  await p.locator('.pf-chest').click();
  await sleep(400);
  await p.locator('[data-chest-open]').click();
  await sleep(300);
  await p.keyboard.press('Escape');
  await sleep(300);
  const mid = await p.evaluate(() => ({
    hidden: document.querySelector('#meta [data-chest]').hidden,
    coins: JSON.parse(localStorage.getItem('snakez.meta')).coins,
  }));
  t(mid.hidden && mid.coins > 5, `ortada kapatma: odul korunur (${mid.coins}), modal kapandi`);
  // tekrar acilabilir (bekleme), cift odul yok
  await p.locator('.pf-chest').click();
  await sleep(400);
  const w = await p.evaluate(() => ({
    noOpen: !document.querySelector('[data-chest-open]'),
    coins: JSON.parse(localStorage.getItem('snakez.meta')).coins,
  }));
  t(w.noOpen && w.coins === mid.coins, 'bekleme: ikinci odul yok');
  await p.keyboard.press('Escape');
  await sleep(300);
  // ileri tarih: hak yok
  await p.evaluate((m) => localStorage.setItem('snakez.chest', JSON.stringify({ last: m, streak: 9 })), morrow);
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  const fw = await p.evaluate(() => ({ ready: !!document.querySelector('.pf-chest.ready') }));
  await p.locator('.pf-chest').click();
  await sleep(400);
  const fw2 = await p.evaluate(() => ({
    noOpen: !document.querySelector('#meta [data-chest]:not([hidden]) [data-chest-open]'),
    txt: document.querySelector('#meta [data-chest] .ch-sub')?.textContent,
  }));
  t(!fw.ready && fw2.noOpen && /Yarın tekrar gel/.test(fw2.txt || ''), `ileri tarih: hak yok (${fw2.txt})`);
  await p.keyboard.press('Escape');
  await sleep(300);
  // bozuk kayit: konsol temiz + acilabilir
  await p.evaluate(() => localStorage.setItem('snakez.chest', 'bozuk{'));
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  t(await p.evaluate(() => !!document.querySelector('.pf-chest.ready')), 'bozuk kayit: hazir sayilir');
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}

// --- Dal 7: mobil 360px + skip (kart dokunmasi) ---
{
  const p = await b.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.99; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 0, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' }));
  });
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  await p.locator('.pf-chest').click();
  await sleep(400);
  await p.locator('[data-chest-open]').click();
  await sleep(300);
  // kart stage'ine dokun: atlar
  await p.locator('.ch-stage').click();
  await sleep(300);
  t(await p.evaluate(() => document.querySelector('.mt-card.ch')?.dataset.phase === 'done'), 'skip: karta dokununca done');
  const ov = await p.evaluate(() => {
    const c = document.querySelector('.mt-card.ch');
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), vw: window.innerWidth, fits: r.left >= -1 && r.right <= window.innerWidth + 1 };
  });
  t(ov.fits, `mobil tasma yok (${ov.w}px / ${ov.vw}px)`);
  await p.screenshot({ path: 'shots/sandik_mobil.png' });
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}
// --- Dal 7b: gercek dagilim (400 claim, istatistiksel) ---
{
  const p = await b.newPage();
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  const d = await p.evaluate(async () => {
    const m = await import('/src/meta/chest.ts');
    const r = { coin: 0, big: 0, cyan: 0, lime: 0, neon: 0, nadir: 0, epik: 0 };
    for (let i = 0; i < 400; i++) {
      localStorage.removeItem('snakez.chest');
      const { reward } = m.claimChest([]);
      if (reward.kind === 'coins') { if (reward.coins >= 1000) r.big++; else r.coin++; }
      else if (reward.key === 'name:cyan') r.cyan++;
      else if (reward.key === 'name:lime') r.lime++;
      else if (reward.key === 'frame:neon') r.neon++;
      else if (['fx:toxic', 'fx:neon', 'name:pink', 'name:gold', 'frame:gold'].includes(reward.key)) r.epik++;
      else r.nadir++;
    }
    return r;
  });
  const ok = d.coin >= 210 && d.coin <= 285 && d.big >= 22 && d.big <= 60
    && d.cyan <= 7 && d.lime >= 8 && d.lime <= 34 && d.neon >= 4 && d.neon <= 22
    && d.epik >= 10 && d.epik <= 40 && d.nadir >= 30 && d.nadir <= 80;
  t(ok, 'dagilim coin:' + d.coin + ' big:' + d.big + ' cyan:' + d.cyan + ' lime:' + d.lime + ' neon:' + d.neon + ' epik:' + d.epik + ' nadir:' + d.nadir);
  await p.close();
}

// --- Dal 8: buyuk coin (r=65 -> 1000) ---
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.65; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 0, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' }));
    localStorage.removeItem('snakez.chest');
  });
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  await p.locator('.pf-chest').click();
  await sleep(400);
  await p.locator('#meta [data-chest]:not([hidden]) [data-chest-open]').click();
  await waitDone(p);
  const r = await p.evaluate(() => ({
    label: document.querySelector('.ch-got')?.textContent,
    coins: JSON.parse(localStorage.getItem('snakez.meta')).coins,
  }));
  t(/Coin$/.test(r.label || '') && r.coins >= 1000 && r.coins <= 10000, `buyuk coin (${r.label})`);
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}

// --- Dal 9: sansli sandik (100 coin -> ikinci hak, seri artmaz) ---
{
  const p = await b.newPage({ viewport: { width: 1920, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { Math.random = () => 0.5; });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 0, coins: 200, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' }));
    localStorage.removeItem('snakez.chest');
  });
  await p.reload({ waitUntil: 'load' });
  await sleep(4000);
  // normal hak
  await p.locator('.pf-chest').click();
  await sleep(400);
  await p.locator('#meta [data-chest]:not([hidden]) [data-chest-open]').click();
  await waitDone(p);
  const s1 = await p.evaluate(() => ({
    coins: JSON.parse(localStorage.getItem('snakez.meta')).coins,
    streak: JSON.parse(localStorage.getItem('snakez.chest')).streak,
  }));
  await p.locator('#meta [data-chest] [data-close]').first().click();
  await sleep(300);
  // beklemede sansli butonu
  await p.locator('.pf-chest').click();
  await sleep(400);
  t(await p.evaluate(() => !!document.querySelector('#meta [data-chest]:not([hidden]) [data-lucky]')), 'sansli butonu gorunur');
  await p.locator('#meta [data-chest]:not([hidden]) [data-lucky]').click();
  await sleep(400);
  t(await p.evaluate(() => !!document.querySelector('#meta [data-chest]:not([hidden]) [data-chest-open]')), 'sansli hak hazir');
  await p.locator('#meta [data-chest]:not([hidden]) [data-chest-open]').click();
  await waitDone(p);
  const s2 = await p.evaluate(() => ({
    coins: JSON.parse(localStorage.getItem('snakez.meta')).coins,
    streak: JSON.parse(localStorage.getItem('snakez.chest')).streak,
    extra: JSON.parse(localStorage.getItem('snakez.chest')).extra,
  }));
  // 200 + 43 (r=50: 25+18) - 100 + 43 = 186, seri 1'de kalir, hak tuketilir
  t(s2.coins === 186 && s2.streak === 1 && s2.extra === false, `sansli: coin ${s1.coins}->${s2.coins}, seri ${s2.streak}`);
  t(errs.length === 0, `konsol temiz${errs.length ? ' -> ' + errs.join(' // ') : ''}`);
  await p.close();
}
console.log(fail === 0 ? '  TUMU GECTI' : `  ${fail}/${total} KALDI`);
await b.close();
process.exit(fail ? 1 : 0);

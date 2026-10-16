import { chromium } from 'playwright';

// Profilim: misafir yolları (gerçek env, girişsiz). Girişli yollar _cloudtest turunda.
const results = [];
const ok = (n, c) => results.push(`${c ? 'PASS' : 'FAIL'} ${n}`);

async function freshPage(vp) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: vp ?? { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  return { b, p, errs };
}

async function startAndKill(p) {
  await p.click('[data-go]');
  await p.waitForFunction(() => { const g = window.__menu?.game; return !!(g?.me && g.me.alive); }, null, { timeout: 15000 });
  await p.evaluate(() => { const g = window.__menu.game; if (g.me?.alive) g.kill(g.me, 0); });
  await p.waitForSelector('.mt-over:not([hidden])', { timeout: 15000 });
}

// ── 1. Menü istatistik düğmesi ──
{
  const { b, p, errs } = await freshPage();
  const st = await p.evaluate(() => {
    const s = document.querySelector('[data-stats]');
    return s ? { tag: s.tagName, label: s.getAttribute('aria-label'), hint: s.querySelector('.mn-hint')?.textContent ?? null } : null;
  });
  ok('istatistik butonu + ipucu', !!st && st.tag === 'BUTTON' && st.label === 'Profilim' && (st.hint || '').includes('Profilim'));
  await p.click('[data-stats]');
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const c = document.querySelector('[data-profile] .mt-card.prf');
    if (!c) return null;
    const grids = [...c.querySelectorAll('.dv-grid')].map((g) => g.children.length);
    return {
      h2: c.querySelector('h2')?.textContent,
      grids,
      tabs: [...c.querySelectorAll('[data-ptab]')].map((x) => x.textContent),
      road: !!c.querySelector('[data-act="prog"]'),
      guest: !!c.querySelector('[data-act="auth"]'),
      mem: !!c.querySelector('.prf-mem'),
    };
  });
  ok('profil açıldı (7+5 kart, 4 sekme)', !!m && m.h2 === 'PROFİLİM' && m.grids.join(',') === '7,5' && m.tabs.join(',') === 'GENEL,BAŞARIMLAR,KOLEKSİYON,GEÇMİŞ' && m.road && m.guest && m.mem);
  // klavye: kapat, odakla, Enter
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const closed = await p.evaluate(() => document.querySelector('[data-profile]').hidden);
  await p.evaluate(() => document.querySelector('[data-stats]').focus());
  await p.keyboard.press('Enter');
  await p.waitForTimeout(500);
  const reopened = await p.evaluate(() => !document.querySelector('[data-profile]').hidden);
  ok('esc kapatır + enter açar', closed === true && reopened === true);
  // sekmeler
  await p.evaluate(() => document.querySelector('[data-ptab="koleksiyon"]').click());
  await p.waitForTimeout(400);
  const coll = await p.evaluate(() => [...document.querySelectorAll('.prf-coll span:last-child')].map((e) => e.textContent));
  ok('koleksiyon 5 satır x/y', coll.length === 5 && coll.every((t) => /^\d+\/\d+$/.test(t || '')));
  await p.evaluate(() => document.querySelector('[data-ptab="gecmis"]').click());
  await p.waitForTimeout(400);
  const empty = await p.evaluate(() => document.querySelector('.prf-empty')?.textContent ?? null);
  ok('boş geçmiş mesajı', !!empty && empty.includes('Henüz oyun yok'));
  // dışarı tıkla kapat
  await p.mouse.click(8, 8);
  await p.waitForTimeout(300);
  ok('dışarı tıklama kapatır', await p.evaluate(() => document.querySelector('[data-profile]').hidden));
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 2. Ölüm kariyeri yazar (2 tur + 20 tavanı) ──
{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  // 20 kayıtlı kariyeri tohumla (tavan testi)
  await p.evaluate(() => {
    const gs = [];
    for (let i = 0; i < 20; i++) gs.push({ t: 1700000000000 - i * 1000, s: 10 + i, d: 30, k: 1, r: 5 });
    localStorage.setItem('snakez.career', JSON.stringify({ v: 1, kills: 20, playSecs: 600, longest: 30, bestRank: 5, coins: 200, totalScore: 390, bestScore: 29, games: gs }));
  });
  await startAndKill(p);
  const c1 = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('snakez.career')); } catch { return null; } });
  ok('kariyer yazıldı (20 tavan, en yeni başta)', !!c1 && c1.games.length === 20 && c1.games[0].t > 1700000000000 && c1.totalScore > 390 && c1.playSecs > 600);
  // ikinci tur
  await p.evaluate(() => document.querySelector('.mt-cta')?.click());
  await p.waitForFunction(() => { const g = window.__menu?.game; return !!(g?.me && g.me.alive); }, null, { timeout: 15000 });
  await p.evaluate(() => { const g = window.__menu.game; if (g.me?.alive) g.kill(g.me, 0); });
  await p.waitForSelector('.mt-over:not([hidden])', { timeout: 15000 });
  const c2 = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('snakez.career')); } catch { return null; } });
  ok('ikinci tur eklendi', !!c2 && c2.games.length === 20 && c2.kills >= c1.kills);
  // profilde geçmiş dolu + trend grafiği
  await p.evaluate(() => document.querySelector('[data-act="menu"]')?.click());
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('[data-stats]')?.click());
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-ptab="gecmis"]').click());
  await p.waitForTimeout(400);
  const hist = await p.evaluate(() => ({
    rows: document.querySelectorAll('.prf-hist li').length,
    svg: !!document.querySelector('.dv-spark svg'),
  }));
  ok('geçmiş 20 satır + trend', hist.rows === 20 && hist.svg === true);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 3. İlerleme modali değişmedi + misafir giriş satırı ──
{
  const { b, p, errs } = await freshPage();
  await p.click('[data-stats]');
  await p.waitForTimeout(400);
  const before = await p.evaluate(() => document.querySelector('.mt-card.prf h2')?.textContent);
  await p.evaluate(() => document.querySelector('.mt-card.prf [data-act="prog"]')?.click());
  await p.waitForTimeout(500);
  const prog = await p.evaluate(() => ({
    h2: document.querySelector('[data-prog] h2')?.textContent ?? null,
    profGone: document.querySelector('[data-profile]').hidden,
  }));
  ok('rütbe yolu ilerlemeyi açar', before === 'PROFİLİM' && prog.h2 === 'İLERLEME' && prog.profGone === true);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.click('[data-stats]');
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('.mt-card.prf [data-act="auth"]')?.click());
  await p.waitForTimeout(500);
  const auth = await p.evaluate(() => document.querySelector('[data-auth] h2')?.textContent ?? null);
  ok('misafir satırı girişi açar', auth === 'GİRİŞ');
  await p.keyboard.press('Escape');
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 5. Başarımlar: liste, özet, toplu açılış + toast ──
{
  const { b, p, errs } = await freshPage();
  await p.click('[data-stats]');
  await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-ptab="basarim"]').click());
  await p.waitForTimeout(400);
  const ach = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.ach li')];
    const bad = rows.filter((li) => !li.querySelector('.rar.ach-rar') || !li.querySelector('.ach-ic svg'));
    return {
      sum: document.querySelector('.ach-sum b')?.textContent ?? null,
      rows: rows.length,
      bad: bad.length,
      rar: [...new Set([...document.querySelectorAll('.ach-rar')].map((e) => e.textContent))].sort().join(','),
      locks: document.querySelectorAll('.ach li.lock .ach-sub').length,
    };
  });
  ok('başarım listesi (0/26, 26 satır, rozet+bar)', ach.sum === '0/26 açıldı' && ach.rows === 26 && ach.bad === 0 && ach.locks === 26 && ach.rar.includes('EFSANEVİ'));
  const fs = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('snakez.career')).firstSeen > 0; } catch { return false; } });
  ok('firstSeen yazıldı', fs === true);
  await b.close();
}
{
  // Toplu açılış: seviye 10+ (xp 1500) + rekor 600 → lv10 + warmup, tek toast.
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.setItem('snakez.meta', JSON.stringify({ xp: 1500, coins: 0, xb: 0, cb: 0, runs: 1, own: [], eqFx: '', eqName: '', eqFrame: '' }));
    localStorage.setItem('snakez.career', JSON.stringify({ v: 1, kills: 0, playSecs: 0, longest: 0, bestRank: 0, coins: 0, totalScore: 0, bestScore: 600, games: [] }));
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.click('[data-stats]');
  await p.waitForTimeout(600);
  const toast = await p.evaluate(() => document.querySelector('.au-toast:not([hidden])')?.textContent ?? null);
  ok('toplu açılış tek toast', toast === '2 başarım açıldı');
  await p.evaluate(() => document.querySelector('[data-ptab="basarim"]').click());
  await p.waitForTimeout(400);
  const st = await p.evaluate(() => ({
    sum: document.querySelector('.ach-sum b')?.textContent ?? null,
    dated: [...document.querySelectorAll('.ach li.open time')].length,
  }));
  ok('2/26 + tarihli satırlar', st.sum === '2/26 açıldı' && st.dated === 2);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 6. Eski kayıt uyumu + ortalamalar + seri ──
{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForTimeout(1000);
  // Eski biçim: yeni alanlar yok (ach/bestKills/firstSeen/streak...).
  await p.evaluate(() => {
    localStorage.setItem('snakez.games', '4');
    localStorage.setItem('snakez.career', JSON.stringify({ v: 1, kills: 10, playSecs: 3700, longest: 900, bestRank: 4, coins: 120, totalScore: 800, bestScore: 300, games: [{ t: 1700000000000, s: 300, d: 900, k: 4, r: 4 }] }));
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.click('[data-stats]');
  await p.waitForTimeout(500);
  const gen = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('.mt-card.prf .dv-grid > div')].map((d) => d.querySelector('small')?.textContent + '=' + d.querySelector('b')?.textContent);
    return {
      avgScore: cells.find((c) => c.startsWith('ORT SKOR=')) ?? null,
      avgDur: cells.find((c) => c.startsWith('ORT SÜRE=')) ?? null,
      avgKill: cells.find((c) => c.startsWith('ORT ELEME=')) ?? null,
      bestKills: cells.find((c) => c.startsWith('EN ÇOK ELEME=')) ?? null,
      mem: document.querySelector('.prf-mem span')?.textContent ?? null,
    };
  });
  ok('ortalamalar (200/15 dk/2,5)', gen.avgScore === 'ORT SKOR=200' && gen.avgDur === 'ORT SÜRE=15 dk' && gen.avgKill === 'ORT ELEME=2,5');
  ok('bestKills varsayılan 0', gen.bestKills === 'EN ÇOK ELEME=0');
  ok('üyelik satırı', !!gen.mem && gen.mem.includes('beri oyuncu'));
  ok('hata yok', errs.length === 0);
  await b.close();
}
{
  // Seri: dün 4 → bugün ölüm → 5 (aynı makine, aynı yerel gün).
  const yd = await p0yd();
  async function p0yd() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const p2 = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForTimeout(1000);
  await p.evaluate((y) => {
    localStorage.setItem('snakez.career', JSON.stringify({ v: 1, kills: 0, playSecs: 0, longest: 0, bestRank: 0, coins: 0, totalScore: 0, bestScore: 0, lastDay: y, streak: 4, bestStreak: 4, games: [] }));
  }, yd);
  await startAndKill(p);
  const st = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('snakez.career')); } catch { return null; } });
  ok('seri 4→5 + en uzun', !!st && st.streak === 5 && st.bestStreak === 5);
  ok('hata yok', errs.length === 0);
  await b.close();
}
{
  const { b, p, errs } = await freshPage({ width: 390, height: 844 });
  const tele = await p.evaluate(() => {
    const el = document.querySelector('[data-stats]');
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), vw: window.innerWidth };
  });
  ok('istatistik taşmaz', tele.left >= 0 && tele.right <= tele.vw);
  await p.click('[data-stats]');
  await p.waitForTimeout(500);
  const sheet = await p.evaluate(() => {
    const m = document.querySelector('[data-profile]');
    const card = m.querySelector('.mt-card.prf');
    const r = card.getBoundingClientRect();
    const nav = m.querySelector('.prf-tabs');
    return { open: !m.hidden, fullW: Math.round(r.width) === window.innerWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, tabsFit: nav.scrollWidth <= nav.clientWidth + 1 };
  });
  ok('alttan panel + taşma yok', sheet.open && sheet.fullW && !sheet.overflow);
  ok('4 sekme sığıyor', sheet.tabsFit === true);
  ok('hata yok', errs.length === 0);
  await b.close();
}
{
  // 360px en dar kasa: sekmelerde ellipsis/taşma yok.
  const { b, p, errs } = await freshPage({ width: 360, height: 740 });
  await p.click('[data-stats]');
  await p.waitForTimeout(500);
  const t = await p.evaluate(() => {
    const nav = document.querySelector('.prf-tabs');
    const clipped = [...nav.querySelectorAll('button')].filter((x) => x.scrollWidth > x.clientWidth + 1).length;
    return { fit: nav.scrollWidth <= nav.clientWidth + 1, clipped, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  ok('360px sekmeler sığıyor', t.fit && t.clipped === 0 && !t.overflow);
  ok('hata yok', errs.length === 0);
  await b.close();
}

console.log(results.join('\n'));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(fail ? `${fail} BAŞARISIZ` : 'TÜMÜ GEÇTİ');
process.exit(fail ? 1 : 0);

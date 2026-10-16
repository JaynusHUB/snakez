import { chromium } from 'playwright';

// Sahte Supabase backend'i: gerçek projeye DOKUNMAZ.
// Oturum localStorage'a ekilir, /auth/v1/user + /rest/v1/profiles yanıtları mocklanır.
const FAKE_URL = 'https://test.supabase.co';
const USER = { id: 'user-test-1', email: 'test@ornek.com', user_metadata: { full_name: 'Test Oyuncu', avatar_url: '' } };
const SESSION = { access_token: 'fake-jwt', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake-refresh', user: USER };

let mockRow = null; // CloudRow | null
let flipOnce = null; // Bir sonraki profiles GET'inden hemen sonra bir kez çalışır (yarış testi).
const upserts = [];
const results = [];
const ok = (n, c) => results.push(`${c ? 'PASS' : 'FAIL'} ${n}`);

async function newPage(seedLocal, seedSession) {
  flipOnce = null;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await p.route('**/test.supabase.co/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/auth/v1/user')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) });
    }
    if (url.includes('/auth/v1/logout')) {
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.includes('/rest/v1/profiles')) {
      if (req.method() === 'GET') {
        // limit(1): satır yoksa 200 + boş dizi (gerçek PostgREST gibi, 406 yok).
        // Yarış testi: yanıt T0 anıyla verilir, hemen ardından dış yazı (T1) işlenir.
        const out = mockRow ? [mockRow] : [];
        if (flipOnce) { const f = flipOnce; flipOnce = null; f(); }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
      }
      // upsert
      const body = JSON.parse(req.postData() || '{}');
      upserts.push(body);
      mockRow = { ...body, updated_at: body.updated_at };
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([mockRow]) });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate(([loc, ses, sess]) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(loc)) localStorage.setItem(k, v);
    if (ses) localStorage.setItem('sb-test-auth-token', JSON.stringify(sess));
  }, [seedLocal, seedSession, SESSION]);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1500);
  return { b, p, errs };
}

const META = (coins, xp, own = []) => JSON.stringify({ xp, coins, xb: 0, cb: 0, runs: 3, own, eqFx: '', eqName: '', eqFrame: '' });
const CAREER = (kills) => JSON.stringify({ v: 1, kills, playSecs: 100, longest: 50, bestRank: 3, coins: 40, totalScore: 300, bestScore: 88, games: [{ t: 1700000000000, s: 88, d: 50, k: 2, r: 3 }] });
/** Eksiksiz boş kariyer: loadCareer yazmaz, imza sabit kalır (temiz-durum testleri için). */
const CAREER0 = JSON.stringify({ v: 1, kills: 0, playSecs: 0, longest: 0, bestRank: 0, coins: 0, totalScore: 0, bestScore: 0, bestKills: 0, firstSeen: 1700000000000, lastDay: '', streak: 0, bestStreak: 0, ach: {}, games: [] });

/** Boş buluta ilk aktarma: senkron işaretini kurar (sonraki blokların zemini). */
async function uploadFlow(p) {
  await p.waitForSelector('.mt-card.au', { timeout: 10000 }).catch(() => null);
  await p.evaluate(() => document.querySelector('[data-mig="upload"]')?.click());
  await p.waitForFunction(() => (document.querySelector('[data-act="sync"] span')?.textContent === 'Kaydedildi'), null, { timeout: 15000 }).catch(() => null);
}

// ── 1. UPLOAD: bulut boş + yerel dolu → sor → aktar ──
{
  mockRow = null; upserts.length = 0;
  const { b, p, errs } = await newPage({ 'snakez.meta': META(500, 1200), 'snakez.best': '88', 'snakez.name': 'Mahmut', 'snakez.skin': '2', 'snakez.career': CAREER(7) }, true);
  await p.waitForSelector('.mt-card.au', { timeout: 10000 }).catch(() => null);
  const t = await p.evaluate(() => document.querySelector('.mt-card.au h2')?.textContent ?? null);
  ok('upload modalı açıldı', t === 'AKTARMA');
  await p.evaluate(() => document.querySelector('[data-mig="upload"]')?.click());
  await p.waitForTimeout(1200);
  const pill = await p.evaluate(() => document.querySelector('[data-act="sync"] span')?.textContent ?? null);
  ok('aktarma sonrası hap Kaydedildi', pill === 'Kaydedildi');
  ok('upsert atıldı', upserts.length >= 1);
  const u = upserts[upserts.length - 1];
  ok('upsert coins/xp doğru', u.coins === 500 && u.xp === 1200 && u.save_data?.v === 1 && u.save_version === 1);
  const ck = await p.evaluate((body) => { try { return JSON.parse(body.save_data.keys['snakez.career']).kills; } catch { return -1; } }, u).catch(() => -1);
  ok('career save_data içinde', ck === 7);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 2. DOWNLOAD: site verisi silindi → giriş → sessiz geri yükleme ──
{
  // mockRow bir önceki turdan dolu (500 coin). Yerel boş.
  upserts.length = 0;
  const { b, p, errs } = await newPage({}, true);
  // sessiz yükleme + reload beklenir
  await p.waitForFunction(() => (localStorage.getItem('snakez.meta') || '').includes('500'), null, { timeout: 15000 }).catch(() => null);
  const coins = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('snakez.meta')).coins; } catch { return -1; } });
  ok('buluttan indirildi (500 coin)', coins === 500);
  const ck = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('snakez.career')).kills; } catch { return -1; } });
  ok('career geri geldi (7 eleme)', ck === 7);
  const backup = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('snakez.backup.')).length);
  ok('yedek alındı', backup >= 1);
  ok('soru sorulmadı', (await p.evaluate(() => !!document.querySelector('.mt-card.au'))) === false);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 3. ÇAKIŞMA: iki taraf dolu+farklı → seçim, birleştirme yok ──
{
  mockRow = { id: 'user-test-1', display_name: 'Test', coins: 50, xp: 100, level: 2, save_data: { v: 1, keys: { 'snakez.meta': META(50, 100) } }, save_version: 1, updated_at: new Date().toISOString() };
  upserts.length = 0;
  const { b, p, errs } = await newPage({ 'snakez.meta': META(900, 2000), 'snakez.best': '120' }, true);
  await p.waitForSelector('.mt-card.au', { timeout: 10000 }).catch(() => null);
  const t = await p.evaluate(() => document.querySelector('.mt-card.au h2')?.textContent ?? null);
  ok('seçim modalı açıldı', t === 'DEVAM');
  const rows = await p.evaluate(() => [...document.querySelectorAll('.mt-card.au .au-prev small')].map((e) => e.textContent));
  ok('iki taraf özeti var', rows.length === 2);
  // Bulutu seç → yedek + reload + yerel = bulut
  await p.evaluate(() => document.querySelector('[data-mig="cloud"]')?.click());
  await p.waitForFunction(() => (localStorage.getItem('snakez.meta') || '').includes('"coins":50'), null, { timeout: 15000 }).catch(() => null);
  const coins = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('snakez.meta')).coins; } catch { return -1; } });
  ok('bulut uygulandı (50 coin)', coins === 50);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 4. İKİ SEKME ÇAKIŞMASI: kaydetmede remote yeniyse üzerine yazma ──
{
  mockRow = { id: 'user-test-1', display_name: 'Test', coins: 50, xp: 100, level: 2, save_data: { v: 1, keys: { 'snakez.meta': META(50, 100) } }, save_version: 1, updated_at: new Date().toISOString() };
  const { b, p, errs } = await newPage({ 'snakez.meta': META(50, 100) }, true);
  await p.waitForTimeout(1200); // sessiz eşitlenme (aynı veri)
  // "Öbür sekme" bulutu günceller (daha yeni updated_at)
  mockRow = { ...mockRow, coins: 777, save_data: { v: 1, keys: { 'snakez.meta': META(777, 100) } }, updated_at: new Date(Date.now() + 60000).toISOString() };
  // Bu sekmede değişiklik yap + bekle (debounce 4sn + yoklama)
  await p.evaluate(() => localStorage.setItem('snakez.best', '999'));
  await p.waitForSelector('.mt-card.au', { timeout: 20000 }).catch(() => null);
  const t = await p.evaluate(() => document.querySelector('.mt-card.au h2')?.textContent ?? null);
  ok('çakışma diyaloğu açıldı', t === 'ÇAKIŞMA');
  const before = upserts.length;
  await p.waitForTimeout(6000);
  ok('üstüne yazılmadı', upserts.length === before);
  // Buradakiyle üzerine yaz → upsert gider
  await p.evaluate(() => document.querySelector('[data-mig="force"]')?.click());
  await p.waitForTimeout(1500);
  ok('force push atıldı', upserts.length === before + 1);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 5. ÇIKIŞ: flush + yerel temizlik + misafir ──
{
  mockRow = { id: 'user-test-1', display_name: 'Test', coins: 60, xp: 110, level: 2, save_data: { v: 1, keys: { 'snakez.meta': META(60, 110) } }, save_version: 1, updated_at: new Date().toISOString() };
  upserts.length = 0;
  const { b, p, errs } = await newPage({ 'snakez.meta': META(60, 110), 'snakez.quality': 'low' }, true);
  await p.waitForTimeout(1500);
  // değişiklik yap, kaydetmeyi bekle
  await p.evaluate(() => localStorage.setItem('snakez.best', '4242'));
  await p.waitForFunction(() => (document.querySelector('[data-act="sync"] span')?.textContent === 'Kaydedildi'), null, { timeout: 25000 }).catch(() => null);
  // çıkış (reload yarışı olabilir: durum yoklaması yeniden denemeli)
  await p.evaluate(() => document.querySelector('[data-authmenu]')?.click());
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-act="signout"]')?.click());
  let st = null;
  for (let i = 0; i < 8 && !st; i++) {
    await p.waitForTimeout(700);
    st = await p.evaluate(() => {
      if (!document.querySelector('.mt-pf .pf-auth')) return null;
      return {
        guestPill: true,
        metaGone: localStorage.getItem('snakez.meta') === null,
        bestGone: localStorage.getItem('snakez.best') === null,
        deviceKept: localStorage.getItem('snakez.quality') === 'low',
        syncGone: localStorage.getItem('snakez.sync') === null,
      };
    }).catch(() => null);
  }
  ok('misafire dönüldü', st?.guestPill === true);
  ok('yerel ilerleme temizlendi', st?.metaGone === true && st?.bestGone === true);
  ok('cihaz ayarı korundu', st?.deviceKept === true);
  ok('senkron işareti temizlendi', st?.syncGone === true);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 6. ÇAKIŞMA BİRLEŞTİRME: ach/seri birleşir, coin birleşmez ──
{
  const today = (() => { const d = new Date(); const p2 = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; })();
  const car = (o) => JSON.stringify({ v: 1, kills: 0, playSecs: 0, longest: 0, bestRank: 0, coins: 0, totalScore: 0, bestScore: 0, games: [], ...o });
  mockRow = {
    id: 'user-test-1', display_name: 'Test', coins: 50, xp: 100, level: 2,
    save_data: { v: 1, keys: { 'snakez.meta': META(50, 100), 'snakez.career': car({ ach: { 'remote-one': 100 }, bestKills: 3, firstSeen: 5000, lastDay: '2020-01-01', streak: 2, bestStreak: 2 }) } },
    save_version: 1, updated_at: new Date().toISOString(),
  };
  upserts.length = 0;
  const { b, p, errs } = await newPage({
    'snakez.meta': META(900, 2000),
    'snakez.career': car({ ach: { 'local-one': 200 }, bestKills: 9, firstSeen: 9000, lastDay: today, streak: 5, bestStreak: 5 }),
  }, true);
  await p.waitForSelector('.mt-card.au', { timeout: 10000 }).catch(() => null);
  ok('birleştirme seçimi açıldı', (await p.evaluate(() => document.querySelector('.mt-card.au h2')?.textContent ?? null)) === 'DEVAM');
  await p.evaluate(() => document.querySelector('[data-mig="local"]')?.click());
  await p.waitForTimeout(1500);
  const u = upserts[upserts.length - 1];
  const mc = u ? await p.evaluate((body) => { try { return JSON.parse(body.save_data.keys['snakez.career']); } catch { return null; } }, u).catch(() => null) : null;
  ok('push atıldı', upserts.length >= 1 && !!mc);
  ok('ach birleşti (ikisi de duruyor)', mc?.ach?.['remote-one'] === 100 && mc?.ach?.['local-one'] === 200);
  ok('coin birleşmedi (yerel 900)', u?.coins === 900);
  ok('bestKills max (9)', mc?.bestKills === 9);
  ok('streak yeni taraf (5)', mc?.streak === 5 && mc?.bestStreak === 5);
  ok('firstSeen eski korunur (5000)', mc?.firstSeen === 5000);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 7. AVATAR MENÜSÜ: Profilim satırı + girişli başlık ──
{
  mockRow = { id: 'user-test-1', display_name: 'Test', coins: 60, xp: 110, level: 2, save_data: { v: 1, keys: { 'snakez.meta': META(60, 110) } }, save_version: 1, updated_at: new Date().toISOString() };
  const { b, p, errs } = await newPage({ 'snakez.meta': META(60, 110) }, true);
  await p.waitForSelector('[data-authmenu]', { timeout: 15000 }).catch(() => null);
  await p.evaluate(() => document.querySelector('[data-authmenu]')?.click());
  await p.waitForTimeout(300);
  const menu = await p.evaluate(() => [...document.querySelectorAll('[data-aumenu] [data-act]')].map((x) => x.textContent));
  ok('menüde Profilim satırı', menu.join('|') === 'Profilim|Çıkış yap');
  await p.evaluate(() => document.querySelector('[data-aumenu] [data-act="profile"]')?.click());
  await p.waitForTimeout(500);
  const pr = await p.evaluate(() => ({
    open: !document.querySelector('[data-profile]').hidden,
    name: document.querySelector('.mt-card.prf .prf-id b')?.textContent ?? null,
    noGuest: !document.querySelector('.mt-card.prf [data-act="auth"]'),
  }));
  ok('profil girişli açıldı', pr.open && pr.name === 'Test Oyuncu' && pr.noGuest);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 8. AYNI CİHAZ DEVAMI: sessiz push, diyalog yok ──
{
  mockRow = null; upserts.length = 0;
  const { b, p, errs } = await newPage({ 'snakez.meta': META(500, 1200), 'snakez.best': '88' }, true);
  await uploadFlow(p);
  const n0 = upserts.length;
  // Gönderilmemiş ölüm artığı (+21 coin), sonra MENÜ (reload).
  await p.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('snakez.meta'));
    m.coins = 521;
    localStorage.setItem('snakez.meta', JSON.stringify(m));
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => (document.querySelector('[data-act="sync"] span')?.textContent === 'Kaydedildi'), null, { timeout: 15000 }).catch(() => null);
  const st = await p.evaluate(() => ({
    dialog: !document.querySelector('[data-auth]').hidden,
    pill: document.querySelector('[data-act="sync"] span')?.textContent ?? null,
  }));
  ok('devamda diyalog yok', st.dialog === false);
  ok('sessiz push atıldı', upserts.length === n0 + 1 && upserts[upserts.length - 1].coins === 521);
  ok('hap Kaydedildi', st.pill === 'Kaydedildi');
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 9. ART ARDA MENÜ: temizken yazma ve diyalog yok ──
{
  // Düşük XP + eksiksiz kariyer: başarım açılımı/imza kayması olmaz.
  mockRow = null; upserts.length = 0;
  const { b, p, errs } = await newPage({ 'snakez.meta': META(50, 100), 'snakez.best': '88', 'snakez.career': CAREER0 }, true);
  await uploadFlow(p);
  const n0 = upserts.length;
  let dlg = false;
  for (let i = 0; i < 5; i++) {
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(1800);
    if (await p.evaluate(() => !document.querySelector('[data-auth]').hidden)) { dlg = true; break; }
  }
  ok('5 geçişte diyalog yok', dlg === false);
  ok('gereksiz yazma yok', upserts.length === n0);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 10. İKİ CİHAZ: işaret eski + yerel kirli → diyalog ──
{
  mockRow = { id: 'user-test-1', display_name: 'Test', coins: 50, xp: 100, level: 2, save_data: { v: 1, keys: { 'snakez.meta': META(50, 100) } }, save_version: 1, updated_at: new Date().toISOString() };
  upserts.length = 0;
  const { b, p, errs } = await newPage({
    'snakez.meta': META(900, 2000),
    'snakez.sync': JSON.stringify({ v: 1, uid: 'user-test-1', updatedAt: '2020-01-01T00:00:00.000Z', sig: 'eski-imza' }),
  }, true);
  await p.waitForSelector('.mt-card.au', { timeout: 10000 }).catch(() => null);
  const t = await p.evaluate(() => document.querySelector('.mt-card.au h2')?.textContent ?? null);
  ok('iki cihazda diyalog çıkar', t === 'DEVAM');
  ok('yazma yapılmadı', upserts.length === 0);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 11. DIŞ DEĞİŞİKLİK + TEMİZ YEREL: sessiz indir ──
{
  mockRow = null; upserts.length = 0;
  const { b, p, errs } = await newPage({ 'snakez.meta': META(50, 100), 'snakez.best': '88', 'snakez.career': CAREER0 }, true);
  await uploadFlow(p);
  const n0 = upserts.length;
  // Dış cihaz yazar (eksiksiz anahtarlar + daha yeni updated_at).
  mockRow = { ...mockRow, coins: 9999, xp: 1300, save_data: { v: 1, keys: { ...mockRow.save_data.keys, 'snakez.meta': META(9999, 1300) } }, updated_at: new Date(Date.now() + 60000).toISOString() };
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => (localStorage.getItem('snakez.meta') || '').includes('9999'), null, { timeout: 15000 }).catch(() => null);
  const coins = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('snakez.meta')).coins; } catch { return -1; } });
  ok('sessiz indirildi (9999 coin)', coins === 9999);
  await p.waitForTimeout(2500);
  ok('soru sorulmadı', (await p.evaluate(() => !!document.querySelector('.mt-card.au'))) === false);
  ok('ek yazma yok', upserts.length === n0);
  ok('hata yok', errs.length === 0);
  await b.close();
}

// ── 12. YARIŞ: okuma ile yazma arasına dış yazı girerse yazılmaz ──
{
  mockRow = null; upserts.length = 0;
  const { b, p, errs } = await newPage({ 'snakez.meta': META(500, 1200), 'snakez.best': '88' }, true);
  await uploadFlow(p);
  await p.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('snakez.meta'));
    m.coins = 521;
    localStorage.setItem('snakez.meta', JSON.stringify(m));
  });
  // İlk profiles GET'i işaret anıyla (T0) döner, hemen ardından T1'e çevrilir:
  // açılış okuması ile sessiz yazının ön-kontrolü arasına dış yazı girer.
  flipOnce = () => {
    mockRow = { ...mockRow, coins: 777, save_data: { v: 1, keys: { ...mockRow.save_data.keys, 'snakez.meta': META(777, 1200) } }, updated_at: new Date(Date.now() + 60000).toISOString() };
  };
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('.mt-card.au', { timeout: 10000 }).catch(() => null);
  const t = await p.evaluate(() => document.querySelector('.mt-card.au h2')?.textContent ?? null);
  ok('yarışta diyalog çıkar', t === 'ÇAKIŞMA');
  const n0 = upserts.length;
  await p.waitForTimeout(3000);
  ok('yazma yapılmadı', upserts.length === n0);
  ok('hata yok', errs.length === 0);
  await b.close();
}

console.log(results.join('\n'));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(fail ? `${fail} BAŞARISIZ` : 'TÜMÜ GEÇTİ');
process.exit(fail ? 1 : 0);

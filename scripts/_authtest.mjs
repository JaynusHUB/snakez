import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('http://localhost:5173', { waitUntil: 'load' });
await p.waitForTimeout(1500);

const pill = await p.evaluate(() => ({
  authBtn: !!document.querySelector('.pf-auth'),
  guestNote: document.querySelector('.au-guest')?.textContent ?? null,
  barInside: (() => { const bar = document.querySelector('.mt-pf'); if (!bar) return false; const r = bar.getBoundingClientRect(); return r.width <= window.innerWidth && r.left >= 0; })(),
}));
console.log('bar:', JSON.stringify(pill));

await p.click('.pf-auth');
await p.waitForTimeout(1600);
const modal = await p.evaluate(() => {
  const m = document.querySelector('[data-auth]');
  const card = m?.querySelector('.mt-card.au');
  const r = card?.getBoundingClientRect();
  return {
    open: !m.hidden, title: m.querySelector('h2')?.textContent,
    googleDisabled: m.querySelector('[data-auth-google]')?.disabled ?? null,
    offMsg: m.querySelector('.au-off')?.textContent ?? null,
    prev: m.querySelector('.au-prev small')?.textContent ?? null,
    perks: m.querySelectorAll('.au-perks li').length,
    fine: !!m.querySelector('.au-fine a[href="/gizlilik.html"][target="_blank"][rel="noopener"]'),
    cardW: Math.round(r?.width ?? 0),
  };
});
console.log('modal:', JSON.stringify(modal));

await p.keyboard.press('Escape');
await p.waitForTimeout(300);
console.log('esc-closed:', await p.evaluate(() => document.querySelector('[data-auth]').hidden));

await p.click('.pf-auth'); await p.waitForTimeout(400);
await p.click('[data-auth-guest]'); await p.waitForTimeout(300);
console.log('guest-closed:', await p.evaluate(() => document.querySelector('[data-auth]').hidden));

// Ölüm nudge: oyuna gir, motorun kill() yolundan öldür (verify.mjs deseni)
await p.click('[data-go]'); await p.waitForTimeout(500);
await p.evaluate(() => { const g = window.__menu.game; if (g.me && g.me.alive) g.kill(g.me, 0); });
await p.waitForTimeout(1600);
const death = await p.evaluate(() => ({
  over: !document.querySelector('.mt-over').hidden,
  nudge: !!document.querySelector('[data-auth-nudge]'),
  nudgeText: document.querySelector('[data-auth-nudge] span')?.textContent ?? null,
}));
console.log('death:', JSON.stringify(death));
await p.evaluate(() => document.querySelector('[data-auth-x]')?.click());
await p.waitForTimeout(300);
console.log('nudge-dismissed:', await p.evaluate(() => !document.querySelector('[data-auth-nudge]')));
// nudge butonu (kapatılmadan önce ayrı tur): sayfayı yenile, tekrar öldür, butona bas.
// Deterministik: sabit uyku yerine overlay/nudge'ın GERÇEKTEN gelmesi beklenir
// (oyuncu bazen botlara doğal ölümle erken ölür, scripted kill boşa düşerdi).
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
await p.click('[data-go]');
await p.waitForFunction(() => { const g = window.__menu?.game; return !!(g?.me && g.me.alive); }, null, { timeout: 15000 });
await p.evaluate(() => { const g = window.__menu.game; if (g.me?.alive) g.kill(g.me, 0); });
await p.waitForSelector('.mt-over:not([hidden])', { timeout: 15000 });
await p.waitForSelector('[data-auth-nudge]', { timeout: 15000 });
await p.evaluate(() => document.querySelector('[data-auth-nudge] [data-act="auth"]')?.click());
await p.waitForTimeout(400);
console.log('nudge-opens-modal:', await p.evaluate(() => !document.querySelector('[data-auth]').hidden));
console.log('errors:', errs.length ? errs.join(' | ') : 'YOK');
await b.close();

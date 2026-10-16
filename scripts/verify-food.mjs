import { chromium } from 'playwright';

// Yem ekonomisi: harita buyudu (WR 5250), zemin stogu (FOOD_N 8125) yogunlugu
// korur, dogus hucre-acikli doldurur, ceset/boost yiginlari zemin sayacina
// girmez. Olculer:
//   1. harita buyuklugu: en uzak yem > eski sinir (4130), hicbiri WR disinda
//   2. esit dagilim: yalniz normal yemler, esit-alanli 3 halkada ~1/3 pay
//   3. muhasebe butunlugu: alanlar hucrelerle birebir tutar
//   4. FPS: yazilimsal render tabaninda regresyon yok (sayilar raporlanir)

const WR = 5250;
const FOOD_N = 8125;

const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  [OK]   ' : '  [HATA] ') + msg);
  if (!cond) fail++;
};

const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const hatalar = [];
p.on('pageerror', (e) => hatalar.push('pageerror:' + e.message));
p.on('console', (m) => { if (m.type() === 'error') hatalar.push('console:' + m.text()); });

await p.goto('http://localhost:5173', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5173', { waitUntil: 'load' });
await p.waitForSelector('.mn-go', { timeout: 8000 });
await sleep(700);
await p.fill('[data-name]', 'Yemci');
await p.press('[data-name]', 'Enter');
await sleep(500);

// 45 sim-saniye: botlar yer, refill + acik-doldurma calisir, olumler olur.
await p.evaluate(() => window.advanceTime(45000));

console.log('\n== Yem dagilimi (45sn oyun sonrasi) ==');
const olcu = await p.evaluate(([wr]) => {
  const g = window.__menu.game;
  const f = g.food;
  let top = 0, reg = 0, dis = 0, maxR = 0;
  const halka = [0, 0, 0];
  const r1 = wr / Math.sqrt(3), r2 = wr * Math.sqrt(2 / 3);
  for (const a of f.cells.values()) {
    for (const q of a) {
      top++;
      if (q.reg) reg++;
      const d = Math.hypot(q.x, q.y);
      if (d > maxR) maxR = d;
      if (d > wr) dis++;
      if (q.reg) halka[d < r1 ? 0 : d < r2 ? 1 : 2]++;
    }
  }
  return { top, regSay: reg, alanReg: f.regular, alanTop: f.count, maxR: Math.round(maxR), dis, halka };
}, [WR]);
console.log(`  toplam=${olcu.top} (alan:${olcu.alanTop}) normal=${olcu.regSay} (alan:${olcu.alanReg}) maxR=${olcu.maxR} halkalar=${olcu.halka.join('/')}`);

ok(olcu.maxR > 4600, `yemler dis bolgelere ulasiyor (maxR ${olcu.maxR}, eski sinir 4130)`);
ok(olcu.dis === 0, `harita disinda yem yok`);
ok(olcu.regSay === olcu.alanReg, `zemin sayaci hucrelerle tutarli (${olcu.alanReg})`);
ok(olcu.top === olcu.alanTop, `toplam sayac tutarli (${olcu.alanTop})`);
const pay = olcu.halka.map((n) => n / Math.max(1, olcu.regSay));
ok(pay.every((x) => Math.abs(x - 1 / 3) <= 0.1), `halkalar esit (~1/3): ${pay.map((x) => x.toFixed(2)).join('/')}`);

console.log('\n== FPS (4sn canli oyun, yazilimsal render) ==');
const fps = await p.evaluate(() => new Promise((res) => {
  const ts = [];
  const t0 = performance.now();
  const tick = (t) => { ts.push(t); if (t - t0 < 4000) requestAnimationFrame(tick); else res(ts); };
  requestAnimationFrame(tick);
}));
const d = fps.slice(1).map((t, i) => t - fps[i]).sort((a, x) => a - x);
const avg = d.reduce((a, x) => a + x, 0) / d.length;
const p95 = d[Math.floor(d.length * 0.95)];
console.log(`  kare=${d.length} ort=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
ok(avg <= 70, `ortalama kare ${avg.toFixed(1)}ms (sinir 70ms)`);
ok(p95 <= 120, `p95 kare ${p95.toFixed(1)}ms (sinir 120ms)`);

ok(hatalar.length === 0, 'konsol hatasi yok' + (hatalar.length ? ' (' + hatalar.join(' | ') + ')' : ''));
await b.close();
console.log(fail ? `\n${fail} HATA` : '\nTUM KONTROLLER GECTI ✓');
process.exit(fail ? 1 : 0);

import { chromium } from 'playwright';

// Kafa-kafa carpismasi: hicbir kosulda ikisi birden olmez, tam biri olur.
// Tum senaryolar TEK evaluate icinde atomik calisir (rAF araya giremez):
// kurgu yilanlar kurulur -> grid.build -> collisions -> sonuclar okunur.
// Kurgu yilanlar createSnake ile ayni alanlara sahiptir (canli bottan
// klon disi, saf veri); me degillerdir, overlay/acilis tetiklenmez.

const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  [OK]   ' : '  [HATA] ') + msg);
  if (!cond) fail++;
};

const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const hatalar = [];
p.on('pageerror', (e) => hatalar.push('pageerror:' + e.message));
p.on('console', (m) => { if (m.type() === 'error') hatalar.push('console:' + m.text()); });
await p.goto('http://localhost:5173', { waitUntil: 'load' });
await sleep(1200);

// Ortak kurgu yardımcısı sayfaya enjekte edilir (her senaryo kendi çağırır).
await p.evaluate(() => {
  window.__clash = (defs) => {
    const g = window.__menu.game;
    const radiusOf = (m) => 9 + 6 * Math.log10(1 + m / 40);
    const mk = (o) => {
      const r = radiusOf(o.mass);
      const dlen = 55 + 10.5 * Math.pow(o.mass, 0.7);
      const tx = [], ty = [];
      const dx = Math.cos(o.ang), dy = Math.sin(o.ang);
      for (let d = dlen + 60; d > 0; d -= 3) { tx.push(o.x - dx * d); ty.push(o.y - dy * d); }
      tx.push(o.x); ty.push(o.y);
      return {
        id: o.id, name: o.name, skin: 0, bot: true, alive: true,
        x: o.x, y: o.y, ang: o.ang, wang: o.ang, mass: o.mass, r, dlen,
        spd: 185, boost: false, boosting: false, fx: 0, drainAcc: 0,
        kills: 0, sp: 0, tx, ty, ts: 0, body: new Float32Array(64), bn: 0,
        think: 9, wander: o.ang, tf: null, tfT: 0, hot: null, aggr: false, caution: 1,
      };
    };
    const run = (list) => {
      const ss = list.map((o, i) => mk({ id: 101 + i, ...o }));
      const n0 = g.food.count;
      g.snakes = ss;
      g.grid.build(ss);
      g.collisions();
      const out = { alive: {}, kills: {}, dFood: g.food.count - n0 };
      for (const s of ss) { out.alive[s.name] = s.alive; out.kills[s.name] = s.kills; }
      return out;
    };
    return run(defs);
  };
});

console.log('\n== (i) yuzden carpan olur, yandan gelen yasar (3 kare, yon degismez) ==');
{
  let hepsi = true;
  for (let k = 0; k < 3; k++) {
    const r = await p.evaluate(() => window.__clash([
      { name: 'A', x: 0, y: 0, ang: 0, mass: 10 },
      { name: 'B', x: 10, y: 7, ang: Math.PI / 2, mass: 10 },
    ]));
    const tamam = r.alive.A === false && r.alive.B === true && r.kills.B === 1 && r.dFood === 4;
    if (!tamam) hepsi = false;
    console.log(`  tur ${k}: A_olu=${!r.alive.A} B_canli=${r.alive.B} B_kill=${r.kills.B} yem=${r.dFood}`);
  }
  ok(hepsi, 'A her seferinde olur, B yasar +1 eleme, yalnizca A yem doker (4)');
}

console.log('\n== (ii) tam karsilikli: 100 tohumda hep tam biri olur ==');
{
  const r = await p.evaluate(() => {
    const kazanan = new Set();
    let kotu = 0;
    for (let s = 0; s < 100; s++) {
      const t = s * 0.037;
      const o = window.__clash([
        { name: 'A', x: 0, y: 0, ang: t, mass: 10 },
        { name: 'B', x: 12 * Math.cos(t), y: 12 * Math.sin(t), ang: t + Math.PI, mass: 10 },
      ]);
      const olen = ['A', 'B'].filter((n) => !o.alive[n]);
      if (olen.length !== 1) { kotu++; continue; }
      const yasayan = olen[0] === 'A' ? 'B' : 'A';
      if (o.kills[yasayan] !== 1) { kotu++; continue; }
      kazanan.add(yasayan);
    }
    return { kotu, kazanan: [...kazanan] };
  });
  ok(r.kotu === 0, `100/100 turda tam biri oldu (hatali: ${r.kotu})`);
  ok(r.kazanan.length === 2, `beraberlik cozumu iki tarafa da duser (${r.kazanan.join(',')})`);
}

console.log('\n== (iii) 500e 500: boy olcut degil, biri yasar ==');
{
  const r = await p.evaluate(() => window.__clash([
    { name: 'A', x: 0, y: 0, ang: 0, mass: 500 },
    { name: 'B', x: 20, y: 0, ang: Math.PI, mass: 500 },
  ]));
  const olen = ['A', 'B'].filter((n) => !r.alive[n]);
  const yasayan = olen.length === 1 ? (olen[0] === 'A' ? 'B' : 'A') : null;
  ok(olen.length === 1, 'tam biri oldu');
  ok(!!yasayan && r.kills[yasayan] === 1, 'yasayan +1 eleme aldi (' + yasayan + ')');
}

console.log('\n== (iv) govdeye carpan olur (mevcut davranis, 3 kare) ==');
{
  // B'nin govdesi yeterince uzun olmali: dlen + iz elle kurulur.
  let hepsi2 = true;
  for (let k = 0; k < 3; k++) {
    const r = await p.evaluate(() => {
      const g = window.__menu.game;
      const base = [
        { name: 'A', x: 195, y: 0, ang: 0, mass: 10 },
        { name: 'B', x: 300, y: 0, ang: 0, mass: 10 },
      ];
      const ss = base.map((o, i) => {
        const r0 = 9 + 6 * Math.log10(1 + o.mass / 40);
        const tx = [], ty = [];
        const dx = Math.cos(o.ang), dy = Math.sin(o.ang);
        for (let d = 460; d > 0; d -= 3) { tx.push(o.x - dx * d); ty.push(o.y - dy * d); }
        tx.push(o.x); ty.push(o.y);
        return {
          id: 101 + i, name: o.name, skin: 0, bot: true, alive: true,
          x: o.x, y: o.y, ang: o.ang, wang: o.ang, mass: o.mass, r: r0, dlen: 400,
          spd: 185, boost: false, boosting: false, fx: 0, drainAcc: 0,
          kills: 0, sp: 0, tx, ty, ts: 0, body: new Float32Array(512), bn: 0,
          think: 9, wander: o.ang, tf: null, tfT: 0, hot: null, aggr: false, caution: 1,
        };
      });
      const n0 = g.food.count;
      g.snakes = ss;
      g.grid.build(ss);
      g.collisions();
      return { aOlu: !ss[0].alive, bCanli: ss[1].alive, bKill: ss[1].kills, dFood: g.food.count - n0 };
    });
    if (!(r.aOlu && r.bCanli && r.bKill === 1 && r.dFood === 4)) hepsi2 = false;
    console.log(`  tur ${k}: A_olu=${r.aOlu} B_canli=${r.bCanli} B_kill=${r.bKill} yem=${r.dFood}`);
  }
  ok(hepsi2, 'govdeye carpan olur, govde sahibi yasar +1 eleme, yalnizca olen doker');
}

console.log('\n== (vi) duvar-olusu kimseyi olduremez ==');
{
  const WR = 5250; // Constants.WR ile ayni olmali
  const r = await p.evaluate(([wr]) => {
    const g = window.__menu.game;
    const mk2 = (o) => {
      const r0 = 9 + 6 * Math.log10(1 + o.mass / 40);
      const tx = [], ty = [];
      const dx = Math.cos(o.ang), dy = Math.sin(o.ang);
      for (let d = 220; d > 0; d -= 3) { tx.push(o.x - dx * d); ty.push(o.y - dy * d); }
      tx.push(o.x); ty.push(o.y);
      return {
        id: o.id, name: o.name, skin: 0, bot: true, alive: true,
        x: o.x, y: o.y, ang: o.ang, wang: o.ang, mass: o.mass, r: r0, dlen: 200,
        spd: 185, boost: false, boosting: false, fx: 0, drainAcc: 0,
        kills: 0, sp: 0, tx, ty, ts: 0, body: new Float32Array(256), bn: 0,
        think: 9, wander: o.ang, tf: null, tfT: 0, hot: null, aggr: false, caution: 1,
      };
    };
    // C duvar disinda (olur, katil 0); B kafasi C'nin kafasina deger ama yasar.
    const ss = [mk2({ id: 102, name: 'B', x: wr - 8, y: 0, ang: Math.PI, mass: 10 }), mk2({ id: 103, name: 'C', x: wr + 4, y: 0, ang: 0, mass: 10 })];
    const n0 = g.food.count;
    g.snakes = ss;
    g.grid.build(ss);
    g.collisions();
    return { bCanli: ss[0].alive, bKill: ss[0].kills, cOlu: !ss[1].alive, dFood: g.food.count - n0 };
  }, [WR]);
  ok(r.cOlu && r.bCanli, 'C duvar olumu olur, B yasar');
  ok(r.bKill === 0 && r.dFood === 4, `B kredi almaz, yalnizca C doker (kill=${r.bKill}, yem=${r.dFood})`);
}

ok(hatalar.length === 0, 'konsol hatasi yok' + (hatalar.length ? ' (' + hatalar.join(' | ') + ')' : ''));
await b.close();
console.log(fail ? `\n${fail} HATA` : '\nTUM KONTROLLER GECTI ✓');
process.exit(fail ? 1 : 0);

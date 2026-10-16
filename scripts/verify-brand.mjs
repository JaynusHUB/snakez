// Logo + ust bant denetimi — SADE KONTROLSUZ DONEM (efektler kaldirildi).
//   A) Her viewport'ta: logo yukleniyor mu, oran, filter/box-shadow yok,
//      efekt DOM'u (.mn-logo-edge/.mn-logo-eye) kaldirildi mi
//   B) Hover: logoda hicbir degisiklik yok (transform none)
//   C) RM: sayfaya giris hareketleri kapali
//   D) Dokunmatik: hicbir sey degismiyor
import { chromium } from 'playwright';
const b = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const bad = (m) => { console.log('  [HATA] ' + m); fail++; };
const ok = (m) => console.log('  [ok] ' + m);

const VPS = [
  { width: 1920, height: 1080 }, { width: 1920, height: 950 },
  { width: 1600, height: 900 }, { width: 1366, height: 768 },
  { width: 1280, height: 720 }, { width: 768, height: 1024 },
  { width: 414, height: 896 }, { width: 320, height: 568 },
];

for (const rm of ['no-preference', 'reduce']) {
  for (const vp of VPS) {
    const p = await b.newPage({ viewport: vp, reducedMotion: rm });
    await p.goto('http://localhost:5173', { waitUntil: 'load' });
    await sleep(2400);
    const s = await p.evaluate(() => {
      const svg = document.querySelector('.mn-logo svg');
      const canvas = document.querySelector('.mn-logo canvas');
      const w = document.querySelector('.mn-logo');
      const cs = svg ? getComputedStyle(svg) : null;
      const R = (sel) => { const e = document.querySelector(sel);
        return e && getComputedStyle(e).display !== 'none' && e.offsetHeight > 0
          ? e.getBoundingClientRect() : null; };
      const ov = (a, c) => a && c
        ? Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left)) *
          Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top)) : 0;
      const br = R('.mn-brand'), cr = R('.mn-copy'), dr = R('.mn-deck');
      return {
        ok: !!(svg && svg.getBoundingClientRect().width > 0),
        filt: cs ? cs.filter : '?', fW: cs ? cs.filter : '?',
        shadow: w ? getComputedStyle(w).boxShadow : '-',
        edgeGone: !document.querySelector('.mn-logo-edge'),
        eyeGone: !document.querySelector('.mn-logo-eye'),
        sweepOk: !!(svg && svg.querySelector('rect')),
        canvasOk: !!canvas,
        imgAnim: cs ? cs.animationName : '?',
        rw: w ? Math.round(w.getBoundingClientRect().width) : 0,
        rh: w ? Math.round(w.getBoundingClientRect().height) : 0,
        over: w ? (w.getBoundingClientRect().right > innerWidth + 1) : false,
        oBC: ov(br, cr), oBD: ov(br, dr),
      };
    });
    if (!s.ok) bad(`${rm}/${vp.width}x${vp.height} — LOGO SVG YOK`);
    if (!s.sweepOk) bad(`${rm}/${vp.width} — tarama bandı (rect) yok`);
    if (!s.canvasOk) bad(`${rm}/${vp.width} — canvas yok`);
    if (s.filt !== 'none') bad(`${rm}/${vp.width} — svg filter ${s.filt}`);
    if (s.shadow !== 'none') bad(`${rm}/${vp.width} — logo shadow var`);
    if (!s.edgeGone) bad(`${rm}/${vp.width} — .mn-logo-edge kaldırılmadı`);
    if (!s.eyeGone) bad(`${rm}/${vp.width} — .mn-logo-eye kaldırılmadı`);
    if (rm === 'no-preference' && s.imgAnim !== 'none')
      bad(`${vp.width}x${vp.height} — svg animasyonu beklenmedik (${s.imgAnim})`);
    if (s.over) bad(`${rm}/${vp.width} — logo ekranı taşıyor`);
    if (s.oBC > 0 || s.oBD > 0) bad(`${rm}/${vp.width} — çakışma`);
    if (s.rw && s.rh && Math.abs(s.rw / s.rh - 720 / 455) > 0.02)
      bad(`${rm}/${vp.width} — oran bozuk ${s.rw}x${s.rh}`);
    await p.close();
  }
  ok(`${rm} — tüm viewport'lar temiz`);
}

// Hover / touch: logoda hiçbir değişiklik olmamalı
{
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await sleep(2400);
  await p.hover('.mn-logo');
  await sleep(400);
  const s = await p.evaluate(() => {
    const w = document.querySelector('.mn-logo');
    return { t: getComputedStyle(w).transform, f: getComputedStyle(w).filter,
             bs: getComputedStyle(w).boxShadow };
  });
  if (s.t !== 'none') bad(`hover transform ${s.t}`);
  if (s.f !== 'none' || s.bs !== 'none') bad(`hover filter/shadow`);
  ok('hover: logo değişmiyor (efekt yok)');
  await p.close();
}
console.log(fail === 0 ? '\n  TEMİZ KONTROLLER GEÇTİ ✓' : `\n  ${fail} HATA`);
await b.close();
process.exit(fail ? 1 : 0);
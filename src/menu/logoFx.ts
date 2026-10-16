// Logonun etrafindaki efekti başlatan kotu:
//   • SVG logo + maskeli RGB tarama bandı (SMIL, 6sn/tur)
//   • Canvas uzerinde disa hat boyunca dolaşan RGB neon çizgisi
//     (fare uzerinde iken + sayfa acilisinda bir kez)
// Kullanicidan gelen standalone HTML'in projeye uyarlanmis hali:
//   - 1983x793 yerine 720x455 (yollar bu alan icin olcekli)
//   - KENAR yollari 720x455'e olcekli (bu modulda hazir)
//   - Logo neonu efekt anahtarından BAĞIMSIZDIR (bilinçli karar): Kapalı
//     konumunda bile logo ve kenar takibi oynar; kalite düşükse yalnızca
//     gölge (shadowBlur) kısılır — utils/settings.ts'ten canlı okunur.
//   - menunun başka bolumune dokunulmaz.
import { qGlow } from '../utils/settings.ts';

export function initLogoFx(root: HTMLElement): () => void {
  const kutu = root.querySelector('.mn-logo') as HTMLElement | null;
  if (!kutu) return () => undefined;
  const svg = kutu.querySelector('svg') as SVGSVGElement | null;
  const tuval = kutu.querySelector('canvas') as HTMLCanvasElement | null;
  if (!svg || !tuval) return () => undefined;

  const c = tuval.getContext('2d');
  if (!c) return () => undefined;

  // ---- AYARLAR (gerekircesine yorum olarak korundu) ----
  const TUR_SURESI = 3;   // ışığın logoyu bir tur dolaşma süresi (sn)
  const KUYRUK = 0.22;    // ışık izinin uzunluğu (0 - 1)
  const KALINLIK = 2.2;   // çizgi kalınlığı (px)
  const PARLAMA = 9;      // neon parlaması (px)
  const ACILISTA_OYNAT = true;
  // --------------------------------------------------------
  const GEN = 720, PAY = 28, NS = 'http://www.w3.org/2000/svg';

  // Dış hattı küçük noktalara böl (KENAR yolları 720x455 koordinat uzayında)
  const KENAR = [
    "M556.4 63.6L546.5 53.6L534.1 44.3L518.1 34.3L498.9 24.3L468.1 13.1L447.1 6.9L426.7 2.5L405.1 0.0L384.7 0.0L361.9 3.1L345.8 7.5L330.4 12.5L307.5 24.3L259.3 53.0L241.4 66.7L230.9 76.7L221.7 88.5L211.8 103.5L206.2 114.7L201.3 126.5L197.0 141.5L192.7 167.0L192.7 185.7L194.5 201.9L153.8 201.9L163.6 185.7L164.3 182.0L161.2 179.5L78.4 179.5L58.7 183.2L43.2 190.7L31.5 200.1L24.7 208.2L19.8 216.3L15.4 228.7L14.2 238.7L16.1 249.9L18.5 256.8L8.0 266.8L1.2 276.7L0.0 281.7L0.0 288.6L2.5 297.9L6.8 302.9L9.9 304.8L14.8 307.3L21.0 308.5L81.5 309.2L82.1 309.8L78.4 314.8L76.0 321.0L75.3 326.6L76.0 332.2L78.4 339.1L81.5 343.4L90.8 349.7L101.9 351.5L209.9 352.2L219.8 369.0L230.3 384.6L243.9 400.2L254.4 409.5L269.2 419.5L283.4 427.0L301.3 433.8L316.2 436.9L337.2 438.8L358.8 436.3L386.6 429.4L423.6 415.7L441.5 410.1L453.9 407.6L463.1 407.0L474.9 407.0L482.3 408.9L498.3 415.1L505.7 420.1L513.1 427.0L521.2 438.2L526.7 455.0L527.3 441.3L526.1 429.4L521.8 417.6L516.8 408.9L505.1 395.2L495.8 387.7L485.4 381.5L466.8 374.6L454.5 372.1L442.1 370.9L424.2 372.1L401.4 375.8L377.9 379.0L361.9 379.0L351.4 377.7L340.2 374.6L327.9 369.0L316.8 360.9L309.4 352.2L632.3 350.9L639.1 349.0L644.7 345.3L649.0 340.3L651.5 335.3L652.7 329.1L652.1 320.4L646.5 309.2L673.7 307.9L686.0 304.8L700.2 297.3L706.4 291.1L713.2 281.7L716.9 273.0L720.0 259.9L719.4 249.9L716.3 236.8L712.0 228.1L704.6 218.2L695.9 211.3L687.9 206.9L678.6 203.8L668.1 201.9L650.8 201.9L640.3 202.6L636.0 201.9L632.3 200.1L629.2 197.6L624.9 188.9L621.8 185.1L613.8 182.6L599.0 182.6L590.3 185.1L582.3 190.1L572.4 200.7L566.2 202.6L547.1 201.9L503.9 201.3L486.6 175.1L473.0 159.6L455.1 143.4L444.6 135.3L426.7 123.4L407.5 114.1L393.3 108.5L364.9 100.3L337.2 96.6L307.5 96.6L321.1 84.1L330.4 77.3L340.2 71.1L353.8 64.2L369.3 59.2L379.1 57.3L391.5 56.7L401.4 58.0L416.8 61.7L432.2 69.2L442.1 76.0L457.6 91.0L469.9 101.0L480.4 106.6L491.5 110.9L511.3 115.9L545.9 121.5L557.6 121.5L569.3 118.4L577.4 124.0L589.7 134.6L609.5 158.9L615.0 163.9L600.8 140.9L610.1 145.2L618.7 147.7L628.6 148.3L632.3 147.7L621.8 145.8L610.1 140.9L598.4 132.8L576.7 114.7L576.1 114.1L578.0 111.6L580.4 106.0L579.8 97.2L573.0 85.4L565.6 74.8Z",
    "M303.8 185.1L311.2 177.6L319.9 175.1L369.3 174.5L354.4 164.5L330.4 154.0L306.9 148.3L292.1 147.1L282.8 147.7L283.4 159.6L288.4 170.8L295.8 180.1L300.7 183.9Z"
  ];
  const yollar = KENAR.map((d) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    const L = p.getTotalLength(), n = Math.max(80, Math.round(L / 6)), pts: number[][] = [];
    for (let i = 0; i < n; i++) { const q = p.getPointAtLength(L * i / n); pts.push([q.x, q.y]); }
    svg.removeChild(p);
    return pts;
  });

  const YESIL = [61, 255, 160], CYAN = [34, 216, 245], MOR = [179, 107, 255];
  const mix = (a: number[], b: number[], t: number) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  const renk = (u: number) => (u < .45 ? mix(YESIL, CYAN, u / .45) : mix(CYAN, MOR, (u - .45) / .55));

  let sc = 1, dpr = 1;
  const boyutla = () => {
    // clientWidth 0 iken (destroy sonrası / gizli) ölçme: sc=0 ciz'de
    // lineWidth'e bölünür ve Infinity üretirdi.
    if (!kutu.clientWidth || !kutu.clientHeight) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    sc = kutu.clientWidth / GEN;
    const w = kutu.clientWidth + PAY * 2, h = kutu.clientHeight + PAY * 2;
    tuval.style.left = tuval.style.top = -PAY + 'px';
    tuval.style.width = w + 'px'; tuval.style.height = h + 'px';
    tuval.width = Math.round(w * dpr); tuval.height = Math.round(h * dpr);
  };
  const ro = window.ResizeObserver ? new ResizeObserver(boyutla) : null;
  if (ro) ro.observe(kutu);
  window.addEventListener('resize', boyutla);
  boyutla();

  const ciz = (faz: number, guc: number) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, tuval.width, tuval.height);
    c.setTransform(dpr * sc, 0, 0, dpr * sc, PAY * dpr, PAY * dpr);
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round'; c.lineJoin = 'round';
    yollar.forEach((pts) => {
      const n = pts.length, f = faz * n, bas = Math.floor(f), t = f - bas;
      const uz = Math.max(10, Math.round(n * KUYRUK));
      const a = pts[bas % n], b = pts[(bas + 1) % n];
      const iz = [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]];
      for (let k = 0; k <= uz; k++) iz.push(pts[((bas - k) % n + n) % n]);
      const parca = 28, adim = Math.max(1, Math.ceil(uz / parca));
      for (let k0 = 0; k0 < uz; k0 += adim) {
        const k1 = Math.min(uz, k0 + adim), u = (k0 + k1) / 2 / uz;
        const r = renk(u);
        const col = 'rgba(' + Math.round(r[0]) + ',' + Math.round(r[1]) + ',' + Math.round(r[2]) + ',' + (Math.pow(1 - u, 1.5) * guc).toFixed(3) + ')';
        c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = PARLAMA * qGlow() * dpr;
        c.lineWidth = KALINLIK * (1 - .55 * u) / sc;
        c.beginPath(); c.moveTo(iz[k0][0], iz[k0][1]);
        for (let k = k0 + 1; k <= k1; k++) c.lineTo(iz[k][0], iz[k][1]);
        c.stroke();
      }
    });
  };

  let uzerinde = false;
  let bitis = ACILISTA_OYNAT ? performance.now() + TUR_SURESI * 1000 + 300 : 0;
  let guc = 0, faz = 0, son = performance.now(), bos = true;
  let dead = false;
  kutu.addEventListener('pointerenter', () => { uzerinde = true; });
  kutu.addEventListener('pointerleave', () => { uzerinde = false; });
  kutu.addEventListener('pointerdown', () => { bitis = performance.now() + TUR_SURESI * 1000; });
  const dongu = (t: number) => {
    if (dead) return;
    const dt = Math.min(.05, (t - son) / 1000); son = t;
    const hedef = (uzerinde || t < bitis) ? 1 : 0;
    if (hedef && guc < .02) faz = 0;
    guc += (hedef - guc) * Math.min(1, dt * (hedef ? 7 : 3.5));
    if (guc > .015) { faz = (faz + dt / TUR_SURESI) % 1; ciz(faz, guc); bos = false; }
    else if (!bos) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, tuval.width, tuval.height); guc = 0; bos = true; }
    requestAnimationFrame(dongu);
  };
  requestAnimationFrame(dongu);
  // Menü kapanınca döngü dursun, gözlemci ve dinleyici sökülsün.
  return () => {
    dead = true;
    ro?.disconnect();
    window.removeEventListener('resize', boyutla);
  };
}

// EFEKT 2 — RGB KENAR TAKİBİ (liderlik tablosu, hover'da)
// Tek bir canvas kullanılır; fare bir SATIRA ya da kartın boş bir
// bölgesine gelince canvas o kutunun üzerine taşınır ve neon çizgi
// kutunun yuvarlak DIŞ hattını dolaşır. Canvas kartın `overflow:hidden`
// sınırının dışında durur → 28px'lik parlama kesilmez.
//   • Yol: kutunun o anki boyutundan yuvarlatılmış dikdörtgen SVG path
//     olarak üretilir, getPointAtLength ile ~6px aralıklı noktalara
//     bölünür (ResizeObserver + kare başına ölçüm ile yenilenir).
//   • Kuyruk dış hattın %22'si; renk yeşil → cyan → mor; opaklık
//     (1-u)^1.5 ile söner; kalınlık 2.2px'ten kuyrukta %45'e iner.
//   • Bellek/hız: satır başına canvas YOK — tek tuval taşınır, yol
//     yalnızca kutu BOYUTU değişince yeniden örneklebilir.
export function initBoardFx(root: HTMLElement): () => void {
  const kart = root.querySelector('.mn-board') as HTMLElement | null;
  const tuval = root.querySelector('canvas.mn-row-fx') as HTMLCanvasElement | null;
  if (!kart || !tuval) return () => undefined;
  const c = tuval.getContext('2d');
  if (!c) return () => undefined;

  // ---- AYARLAR (gerekirse buradan değiştir) ----
  const TUR_SURESI = 3;   // bir tur süresi (sn)
  const KUYRUK = 0.22;    // kuyruk uzunluğu (dış hattın oranı, 0 - 1)
  const KALINLIK = 2.2;   // başlangıç kalınlığı (px)
  const PARLAMA = 9;      // neon parlaması (px)
  const ACILISTA_OYNAT = true;
  // -----------------------------------------------
  const PAY = 28, NS = 'http://www.w3.org/2000/svg';

  const YESIL: number[] = [61, 255, 160], CYAN: number[] = [34, 216, 245], MOR: number[] = [179, 107, 255];
  const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const renk = (u: number) => (u < .45 ? mix(YESIL, CYAN, u / .45) : mix(CYAN, MOR, (u - .45) / .55));

  const rr = (w: number, h: number, r: number) =>
    `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;

  // Yolu ~6px aralıklı noktalara böl (geçici bir SVG'ye ekleyip ölç).
  const topla = (d: string): number[][] => {
    const tmp = document.createElementNS(NS, 'svg') as SVGSVGElement;
    tmp.setAttribute('width', '0'); tmp.setAttribute('height', '0');
    tmp.setAttribute('style', 'position:absolute;pointer-events:none');
    const p = document.createElementNS(NS, 'path') as SVGPathElement;
    p.setAttribute('d', d);
    tmp.appendChild(p);
    document.body.appendChild(tmp);
    const L = p.getTotalLength(), n = Math.max(80, Math.round(L / 6)), pts: number[][] = [];
    for (let i = 0; i < n; i++) { const q = p.getPointAtLength(L * i / n); pts.push([q.x, q.y]); }
    document.body.removeChild(tmp);
    return pts;
  };

  // Çizilecek kutu: satır (`li.mn-row`) ya da kartın kendisi.
  let kutu: HTMLElement | null = null;
  let yolPts: number[][] = [];
  let W = 0, H = 0, dpr = 1, lastL = -1, lastT = -1;

  // Kutuyu ölç → tuvali kutudan PAY kadar dışarı taşı, yol yenile.
  const yerles = () => {
    if (!kutu) return;
    const r = kutu.getBoundingClientRect(), rr0 = root.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 10 || h < 10) { tuval.style.display = 'none'; return; }
    tuval.style.display = '';
    if (w !== W || h !== H) {
      W = w; H = h;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = W + PAY * 2, ch = H + PAY * 2;
      tuval.style.width = cw + 'px'; tuval.style.height = ch + 'px';
      tuval.width = Math.round(cw * dpr); tuval.height = Math.round(ch * dpr);
      const rad = parseFloat(getComputedStyle(kutu).borderTopLeftRadius) || 0;
      yolPts = topla(rr(W, H, Math.max(0, Math.min(rad, W / 2, H / 2))));
    }
    // Kare başına layout-thrash önleme: konum değişmediyse yazma.
    const L = Math.round(r.left - rr0.left - PAY), T = Math.round(r.top - rr0.top - PAY);
    if (L !== lastL || T !== lastT) {
      lastL = L; lastT = T;
      tuval.style.left = L + 'px';
      tuval.style.top = T + 'px';
    }
  };

  const ciz = (faz: number, guc: number) => {
    if (!yolPts.length) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, tuval.width, tuval.height);
    c.setTransform(dpr, 0, 0, dpr, PAY * dpr, PAY * dpr);
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round'; c.lineJoin = 'round';
    const pts = yolPts, n = pts.length, f = faz * n, bas = Math.floor(f), t = f - bas;
    const uz = Math.max(10, Math.round(n * KUYRUK));
    const a = pts[((bas % n) + n) % n], b = pts[(((bas + 1) % n) + n) % n];
    const iz: number[][] = [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]];
    for (let k = 0; k <= uz; k++) iz.push(pts[(((bas - k) % n) + n) % n]);
    const parca = 28, adim = Math.max(1, Math.ceil(uz / parca));
    for (let k0 = 0; k0 < uz; k0 += adim) {
      const k1 = Math.min(uz, k0 + adim), u = (k0 + k1) / 2 / uz;
      const r = renk(u);
      const col = 'rgba(' + Math.round(r[0]) + ',' + Math.round(r[1]) + ',' + Math.round(r[2]) + ',' + (Math.pow(1 - u, 1.5) * guc).toFixed(3) + ')';
      c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = PARLAMA * qGlow() * dpr;
      c.lineWidth = KALINLIK * (1 - .55 * u);
      c.beginPath(); c.moveTo(iz[k0][0], iz[k0][1]);
      for (let k = k0 + 1; k <= k1; k++) c.lineTo(iz[k][0], iz[k][1]);
      c.stroke();
    }
  };

  // İmleç kartın içindeyken alttaki satırı (yoksa kartı) hedef al.
  let ix = 0, iy = 0;
  const coz = (x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y);
    if (!el || !kart!.contains(el)) return null;
    return (el as Element).closest('.mn-row') as HTMLElement | null || kart;
  };
  const sec = (el: HTMLElement | null) => {
    if (el === kutu) return;
    kutu = el; faz = 0; yerles();   // her yeni kutuda tur başından başla
  };

  let uzerinde = false;
  let bitis = ACILISTA_OYNAT ? performance.now() + TUR_SURESI * 1000 + 300 : 0;
  if (ACILISTA_OYNAT) kutu = kart;
  let faz = 0, guc = 0, son = performance.now(), bos = true;

  kart.addEventListener('pointerenter', (e) => {
    uzerinde = true; ix = e.clientX; iy = e.clientY;
    sec(coz(ix, iy)); faz = 0;
  });
  kart.addEventListener('pointermove', (e) => {
    uzerinde = true; ix = e.clientX; iy = e.clientY;
    sec(coz(ix, iy));
  });
  kart.addEventListener('pointerleave', () => { uzerinde = false; });
  kart.addEventListener('pointerdown', (e) => {   // dokunmatik: bir tur oynasın
    ix = e.clientX; iy = e.clientY;
    uzerinde = true; sec(coz(ix, iy)); faz = 0;
    bitis = performance.now() + TUR_SURESI * 1000;
  });

  const onYer = (): void => { if (kutu) yerles(); };
  const roB = window.ResizeObserver ? new ResizeObserver(onYer) : null;
  if (roB) roB.observe(kart);
  window.addEventListener('resize', onYer);

  let dead = false;
  const dongu = (t: number) => {
    if (dead) return;
    const dt = Math.min(.05, (t - son) / 1000); son = t;
    // Canlı tablo satırları yeniden kurulmuşsa imleçten yeniden çöz.
    if (kutu && !kutu.isConnected) sec(coz(ix, iy));
    const hedef = (kutu && (uzerinde || t < bitis)) ? 1 : 0;
    guc += (hedef - guc) * Math.min(1, dt * (hedef ? 7 : 3.5));
    if (guc > .015) {
      yerles();
      faz = (faz + dt / TUR_SURESI) % 1;
      ciz(faz, guc); bos = false;
    } else if (!bos) {   // ışık görünmüyor → tuvali temizle
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, tuval.width, tuval.height);
      guc = 0; bos = true;
    }
    requestAnimationFrame(dongu);
  };
  requestAnimationFrame(dongu);
  // Menü kapanınca döngü dursun, gözlemci ve dinleyici sökülsün.
  return () => {
    dead = true;
    roB?.disconnect();
    window.removeEventListener('resize', onYer);
  };
}

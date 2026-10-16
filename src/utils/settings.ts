// Efekt anahtarı: OTOMATİK (sistemi izler) / AÇIK / KAPALI.
//
// Neden merkezi: efektler eskiden doğrudan `prefers-reduced-motion` medya
// sorgusuna bakıyordu; W11'de Animasyon Efektleri kapalı olan oyuncu oyunu
// "bozuk" sanıyordu. Artık tek doğruluk kaynağı burası:
//   - CSS, `.fx-calm` sınıfı varken kapatır (medya sorgusu yok).
//   - JS, `fxCalm()` sorar (matchMedia dağınık değil).
// Katman kuralı korunur: nötr `utils/` herkes okur, kimseye yazmaz.
export type FxMode = 'auto' | 'on' | 'off';

const KEY = 'snakez.fx';
const SYS = '(prefers-reduced-motion: reduce)';

function sysCalm(): boolean {
  try {
    return window.matchMedia(SYS).matches;
  } catch {
    return false;
  }
}

function load(): FxMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' || v === 'auto' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let mode: FxMode = load();

// Önbellekli sakinlik: `fxCalm()` kare/yem başına çağrılır (ölüm yemi,
// shake, vitrin), o yüzden burada `matchMedia` YOK — salt boolean okuma.
// Değer modül düzeyinde bir kez hesaplanır; yalnızca ayar değişince
// (setFxMode/paint) veya sistem sorgusu değişince (initFx dinleyicisi)
// güncellenir. `on`/`off` dalları matchMedia'ya hiç dokunmaz.
let calm: boolean = mode === 'on' ? false : mode === 'off' ? true : sysCalm();

function recompute(): void {
  if (mode === 'on') calm = false;
  else if (mode === 'off') calm = true;
  else calm = sysCalm();
}

export function fxMode(): FxMode {
  return mode;
}

/** Efektler sakin mi kalsın? `on` sistemi ezer (her zaman oynar). */
export function fxCalm(): boolean {
  return calm;
}

function paint(): void {
  recompute();
  document.documentElement.classList.toggle('fx-calm', calm);
  document.documentElement.dataset.fx = mode;
  document.documentElement.dataset.q = quality;
}

export function setFxMode(m: FxMode): void {
  mode = m;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* kota dolu veya gizli mod — oyun yine oynanır, kayıt yapılmaz */
  }
  paint();
  window.dispatchEvent(new Event('snakez:fx'));
}

/** main.ts başında bir kez: sınıfı uygula + sistem değişimini izle. */
export function initFx(): void {
  paint();
  try {
    const mq = window.matchMedia(SYS);
    mq.addEventListener('change', () => {
      if (mode === 'auto') paint();
    });
  } catch {
    /* eski tarayıcı — auto yine de ilk değerle çalışır */
  }
}

// ── Kalite: parça efekt yoğunluğu ──────────────────────────────────────
export type Quality = 'low' | 'med' | 'high';
const QKEY = 'snakez.quality';

function loadQ(): Quality {
  try {
    const v = localStorage.getItem(QKEY);
    return v === 'low' || v === 'med' || v === 'high' ? v : 'high';
  } catch {
    return 'high';
  }
}

let quality: Quality = loadQ();

export function qMode(): Quality {
  return quality;
}

/** Doğum hızı çarpanı: düşükte ~üçte bir parçacık. */
export function qRate(): number {
  return quality === 'low' ? 0.35 : quality === 'med' ? 0.7 : 1;
}

/** Yılan başına parçacık tavanı. */
export function qMax(): number {
  return quality === 'low' ? 20 : quality === 'med' ? 40 : 60;
}

/**
 * Parlama + gölge çarpanı: canvas `shadowBlur` ve glow sprite alfalarını
 * ölçekler. Düşükte 0 → glow geçişleri atlanır, gölge kurulmaz (en pahalı
 * iki kalem); ortada yarım; yüksekte tam.
 */
export function qGlow(): number {
  return quality === 'low' ? 0 : quality === 'med' ? 0.5 : 1;
}

export function setQuality(q: Quality): void {
  quality = q;
  try {
    localStorage.setItem(QKEY, quality);
  } catch {
    /* kota dolu veya gizli mod */
  }
  document.documentElement.dataset.q = quality;
  window.dispatchEvent(new Event('snakez:fx'));
}

// ── FPS sayacı açma/kapama ─────────────────────────────────────────────
const FKEY = 'snakez.fps';

function loadF(): boolean {
  try {
    return localStorage.getItem(FKEY) === '1';
  } catch {
    return false;
  }
}

let fps = loadF();

export function fpsOn(): boolean {
  return fps;
}

export function setFpsOn(v: boolean): void {
  fps = v;
  try {
    localStorage.setItem(FKEY, v ? '1' : '0');
  } catch {
    /* kota dolu veya gizli mod */
  }
  window.dispatchEvent(new Event('snakez:fx'));
}

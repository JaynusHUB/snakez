// FPS sayacı: ayarlarda açılınca sağ üstte küçük gösterir. Menüde de
// oyunda da görünür (menüde gizleniyordu, "çalışmıyor" sanılıyordu).
import { fpsOn } from './settings.ts';

let el: HTMLElement | null = null;
let on = false;
let frames = 0;
let last = 0;
let running = false;

function render(): void {
  if (el) el.hidden = !on;
}

function loop(t: number): void {
  if (!on) { running = false; return; }
  if (!last) last = t;
  frames++;
  const dt = t - last;
  if (dt >= 500) {
    if (el) el.textContent = Math.round((frames * 1000) / dt) + ' FPS';
    frames = 0;
    last = t;
  }
  requestAnimationFrame(loop);
}

function ensure(): void {
  if (el) return;
  el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-fpsmeter', '');
  el.style.cssText =
    'position:fixed;right:12px;top:12px;z-index:15;pointer-events:none;' +
    'font:600 11px ui-monospace,monospace;letter-spacing:.06em;color:#a3aecb;' +
    'background:rgb(10 14 25 / 72%);border:1px solid rgb(242 245 255 / 12%);' +
    'border-radius:8px;padding:4px 8px;';
  el.hidden = true;
  document.body.appendChild(el);
}

/** Ayar değişince menüden çağrılır. */
export function setFpsMeter(v: boolean): void {
  on = v;
  if (v) {
    ensure();
    // Tekrar çağrıda ikinci döngü başlatma: iki eşzamanlı rAF sayacı
    // kareleri çift sayıp şişkin FPS gösteriyordu.
    if (running) { render(); return; }
    running = true;
    frames = 0;
    last = 0;
    requestAnimationFrame(loop);
  }
  render();
}

/** Sayfa açılışında: kayıtlıysa sayacı hazırla. */
export function initFpsMeter(): void {
  if (fpsOn()) setFpsMeter(true);
}

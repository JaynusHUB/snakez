// Market'in DOM bağları: showroom önizleme, canlı efekt kartları, 3B eğim, geri sayım, arka plan.
// Hem oyun (meta.ts) hem bağımsız önizleme aynı kodu kullanır.
import { SHOP_SKINS, fxById, msToMidnight } from './catalog.ts';
import { drawBadgeFrame, paintDeathBadge } from '../systems/DeathFx.ts';
import { Ambient, FxStage } from './fxstage.ts';
import { paintSwatch } from '../menu/vitrine.ts';
import { preloadSkinSprites } from '../systems/SpriteSkins.ts';

interface Base { colors: string[]; img?: string; fxId: string; title: string; skin?: number }

export function bindShop(root: HTMLElement, base: Base, thumbs: Record<string, string>, skinColors: (idx: number) => string[]): () => void {
  const stages: FxStage[] = [], timers: number[] = [], amb: Ambient[] = [];
  let dead = false;
  const q = <T extends HTMLElement>(s: string): T | null => root.querySelector<T>(s);
  const show = q<HTMLCanvasElement>('canvas[data-stage="show"]');
  const fxName = (id: string): string => (id ? `+ ${fxById(id)?.name} efekti` : 'Efekt takılı değil');
  const spec = (colors: string[], fxId: string, img?: string, skin?: number) => ({ cfg: fxById(fxId)?.cfg ?? null, colors, img, r: 13, skin });
  const st = show ? new FxStage(show, spec(base.colors, base.fxId, base.img, base.skin)) : null;
  if (st) stages.push(st);
  const cap = (l: string, n: string, s: string): void => {
    const a = q('[data-capl]'), b = q('[data-capn]'), c = q('[data-caps]');
    if (a) a.textContent = l; if (b) b.textContent = n; if (c) c.textContent = s;
  };
  cap('ŞU AN KULLANILAN', base.title, fxName(base.fxId));

  const preview = (key: string | null): void => {
    if (!st) return;
    if (!key) { st.set(spec(base.colors, base.fxId, base.img, base.skin)); cap('ŞU AN KULLANILAN', base.title, fxName(base.fxId)); return; }
    const [k, id] = key.split(':');
    if (k === 'skin') {
      const s = SHOP_SKINS.find((x) => x.id === id);
      if (s) { st.set(spec(skinColors(s.idx), base.fxId, thumbs[id], s.idx)); cap('ÖNİZLEME · GÖRÜNÜM', s.name, fxName(base.fxId)); }
    } else if (k === 'fx') {
      st.set(spec(base.colors, id, base.img, base.skin)); cap('ÖNİZLEME · EFEKT', base.title, fxName(id));
    }
  };

  root.querySelectorAll<HTMLElement>('[data-pv]').forEach((card) => {
    const key = card.dataset.pv!;
    card.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') preview(key); });
    card.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') preview(null); });
    card.addEventListener('focusin', () => preview(key));
    card.addEventListener('focusout', () => preview(null));
    card.querySelector('.mk-art')?.addEventListener('click', () => preview(key));
    const cv = card.querySelector<HTMLCanvasElement>('canvas[data-fxc]');
    if (cv) {
      const s = new FxStage(cv, { cfg: fxById(cv.dataset.fxc!)?.cfg ?? null, colors: base.skin !== undefined ? base.colors : ['#8f7bff', '#5f9bff', '#2be7ff'], r: 7, skin: base.skin });
      stages.push(s);
      card.addEventListener('pointerenter', () => { s.boost = true; });
      card.addEventListener('pointerleave', () => { s.boost = false; });
    }
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${((px - 0.5) * 12).toFixed(1)}deg`); card.style.setProperty('--rx', `${((0.5 - py) * 10).toFixed(1)}deg`);
      card.style.setProperty('--gx', `${(px * 100).toFixed(0)}%`); card.style.setProperty('--gy', `${(py * 100).toFixed(0)}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--gx', '50%'); card.style.setProperty('--gy', '50%'); });
  });

  // Görünüm kartları: menüdeki gibi baş + gövde + kuyruk (oyunun kendi çizicisi).
  const paint = (): void => {
    const d = Math.min(2, devicePixelRatio || 1);
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-swatch]').forEach((cv) => { if (cv.clientWidth > 0) paintSwatch(cv, Number(cv.dataset.swatch), d); });
    // Ölüm yemi rozetleri: önce statik boya, sprite gelince animasyon devralır.
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-deathfx]').forEach((cv) => { if (cv.clientWidth > 0) paintDeathBadge(cv, cv.dataset.deathfx!); });
  };
  paint(); requestAnimationFrame(paint); preloadSkinSprites().then(() => { if (!dead) paint(); });
  // Rozet animasyonu: küçük saçılma salınımı (kart açıkken sürer, kapanınca durur).
  const badges = (): void => {
    if (dead) return;
    const t = performance.now() / 1000;
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-deathfx]').forEach((cv) => {
      if (cv.clientWidth > 0) drawBadgeFrame(cv, cv.dataset.deathfx!, t);
    });
    requestAnimationFrame(badges);
  };
  requestAnimationFrame(badges);

  const cd = q('[data-cd]');
  if (cd) {
    const tick = (): void => {
      const s = Math.floor(msToMidnight() / 1000), p = (n: number): string => String(n).padStart(2, '0');
      cd.textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
    };
    tick(); timers.push(window.setInterval(tick, 1000));
  }
  const ac = q<HTMLCanvasElement>('canvas.mk-amb');
  if (ac) amb.push(new Ambient(ac));

  return () => { dead = true; stages.forEach((s) => s.dispose()); amb.forEach((a) => a.dispose()); timers.forEach((t) => clearInterval(t)); };
}

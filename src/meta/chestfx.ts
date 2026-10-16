// Sandık açılış orkestratörü: tek doğruluk kaynağı burada.
// Karta `data-phase="tension|burst|reveal|done"`, modal köke
// `is-tension|is-burst|is-reveal|is-badge|is-done` class'ları koyar,
// gerisini CSS yapar. Tüm timeout'lar + count-up rAF'i tek listede;
// dönen {dispose, skip} kaynakları bırakmaz.
//
// Sıra garantisi meta.ts'te: AÇ'a basınca ÖNCE claimChest + store, SONRA bu
// başlar. Yarıda kesilse bile ödül verilmiştir; animasyon sadece görünürlük.
// Sakin modda faz yoktur: tek karede statik ama EKSİKSİZ sonuç.
import { chestInward, chestWave1, chestWave2, stopChestParts } from './chestparts.ts';
import type { ChestTier } from './chestparts.ts';
import { fxCalm } from '../utils/settings.ts';

export type ChestRarity = ChestTier;

const T_BURST = 800;
const T_BURST2 = 1050;
const T_REVEAL = 1000;
const T_BADGE = 1300;
const T_DONE = 1800;
const T_SETTLE = 2400;
const COUNT_MS = 620;

const easeOut = (p: number): number => 1 - Math.pow(1 - p, 3);

/** Kart tıklaması (buton dışı) animasyonu atlar — dokunmatik alternatifi. */
function skipTarget(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && !t.closest?.('button');
}

export interface ChestCtl {
  dispose: () => void;
  skip: () => void;
}

export function startChestFx(
  card: HTMLElement,
  modal: HTMLElement,
  o: { tier: ChestTier; coins: number },
): ChestCtl {
  const timers: number[] = [];
  let raf = 0;
  let finished = false;
  const later = (ms: number, fn: () => void): void => {
    timers.push(window.setTimeout(fn, ms));
  };
  const stopRaf = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const countEl = card.querySelector<HTMLElement>('[data-count]');
  const writeCount = (v: number): void => {
    if (countEl) countEl.textContent = Math.round(v).toLocaleString('tr-TR');
  };
  const openBox = (): void => {
    card.querySelector('.ch-box')?.classList.add('open');
  };
  const buzz = (p: number | number[]): void => {
    try {
      if (!fxCalm() && 'vibrate' in navigator) navigator.vibrate(p);
    } catch {
      /* destek yoksa sessiz geç */
    }
  };
  const shakeCard = (): void => {
    card.classList.add('ch-shake');
    later(230, () => card.classList.remove('ch-shake'));
  };

  // Son kare: animasyonsuz, EKSİKSİZ sonuç (sakin mod + atla).
  const applyFinal = (): void => {
    while (timers.length) window.clearTimeout(timers.pop()!);
    stopRaf();
    stopChestParts();
    modal.classList.remove('ch-shake');
    card.classList.remove('ch-shake');
    modal.classList.add('is-tension', 'is-burst', 'is-reveal', 'is-badge', 'is-done');
    openBox();
    card.dataset.phase = 'done';
    writeCount(o.coins);
    settle();
  };
  const settle = (): void => {
    finished = true;
    modal.classList.remove('ch-anim');
    const k = card.querySelector<HTMLElement>('.ch-row .k');
    if (k && !modal.hidden) k.focus({ preventScroll: true });
  };
  const finish = (): void => {
    if (finished) return;
    applyFinal();
  };
  const dispose = (): void => {
    while (timers.length) window.clearTimeout(timers.pop()!);
    stopRaf();
    stopChestParts();
    card.removeEventListener('click', onSkip);
    // Modal kök mount'ta korunur (innerHTML değişir, class kalır): is-*
    // temizlenmezse SONRAKİ açılış bitmiş animasyon stilleriyle açılırdı
    // (vinyet görünür, satır açık). Kapatırken sıfırla.
    modal.classList.remove('ch-anim', 'is-tension', 'is-burst', 'is-reveal', 'is-badge', 'is-done');
    modal.removeAttribute('data-tier');
    card.removeAttribute('data-phase');
  };
  const onSkip = (e: Event): void => {
    if (!finished && skipTarget(e)) finish();
  };
  const skip = (): void => {
    if (!finished) finish();
  };

  if (fxCalm()) {
    applyFinal();
    settle();
    return { dispose: () => undefined, skip: () => undefined };
  }

  modal.dataset.tier = o.tier;
  modal.classList.add('ch-anim');
  card.classList.add('ch-anim');
  card.dataset.phase = 'tension';
  modal.classList.add('is-tension');
  card.addEventListener('click', onSkip);

  const cv = modal.querySelector('canvas.ch-fx') as HTMLCanvasElement | null;
  const box = card.querySelector('.ch-box') as HTMLElement | null;
  const center = (): { x: number; y: number } => {
    if (!box) return { x: window.innerWidth / 2, y: window.innerHeight * 0.44 };
    const r = box.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.46 };
  };
  if (cv) {
    const c = center();
    chestInward(cv, c.x, c.y);
  }

  later(T_BURST, () => {
    card.dataset.phase = 'burst';
    modal.classList.add('is-burst');
    if (cv) {
      const c = center();
      chestWave1(cv, c.x, c.y, o.tier);
    }
    if (o.tier === 'epik') shakeCard();
    buzz(o.tier === 'epik' ? [40, 30, 90] : o.tier === 'nadir' ? [30, 20, 50] : 30);
  });
  later(T_BURST2, () => {
    if (cv) {
      const c = center();
      chestWave2(cv, c.x, c.y - 6, o.tier);
    }
  });
  later(T_REVEAL, () => {
    card.dataset.phase = 'reveal';
    modal.classList.add('is-reveal');
    if (countEl && o.coins > 0) {
      const t0 = performance.now();
      const step = (t: number): void => {
        const p = Math.min(1, (t - t0) / COUNT_MS);
        writeCount(o.coins * easeOut(p));
        if (p < 1) raf = requestAnimationFrame(step);
        else {
          raf = 0;
          card.querySelector('.ch-amt')?.classList.add('pop');
        }
      };
      raf = requestAnimationFrame(step);
    }
  });
  later(T_BADGE, () => {
    modal.classList.add('is-badge');
  });
  later(T_DONE, () => {
    card.dataset.phase = 'done';
    openBox();
    modal.classList.add('is-done');
  });
  later(T_SETTLE, () => {
    settle();
  });
  return { dispose, skip };
}

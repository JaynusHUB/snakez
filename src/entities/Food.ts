import { FC, PAL, WR } from '../utils/Constants.ts';
import { ckey, cellOf, pelR, rnd } from '../utils/MathUtils.ts';
import type { Snake } from './Snake.ts';

interface Pellet {
  x: number;
  y: number;
  v: number;
  c: string;
  r: number;
  ph: number;
  born: number;
  dead: boolean;
  spr: HTMLCanvasElement;
  /** Normal doğuş mu? Ölüm/boost yemleri false: zemin stoğu (FOOD_N) hesabına girmez. */
  reg: boolean;
  /** Ölüm yemi efekt teması (0 = yok). Kütle/boyut/değeri değiştirmez. */
  fx: number;
  /** Saçılma kökeni (ölüm merkezi). Yalnızca Blue Dragon görselinde
      kullanılır; mantıksal konum (x, y) ve toplanma aynen korunur. */
  ox: number;
  oy: number;
}

export interface Hot {
  x: number;
  y: number;
  r: number;
}

export interface Flying {
  x: number;
  y: number;
  sx: number;
  sy: number;
  t: number;
  v: number;
  r: number;
  spr: HTMLCanvasElement;
  s: Snake;
  /** Toplanan yemin efekt teması (uçuşta da tema paleti sürsün diye). */
  fx: number;
  /** Yerdeki sabit duruş açısı (uçuşta sprite ile taşınır). */
  rot: number;
}

export type SpriteFactory = (color: string) => HTMLCanvasElement;

export class FoodField {
  cells = new Map<number, Pellet[]>();
  count = 0;
  /** Zemin stoğu: yalnızca normal doğuşlar. Ceset/boost yığınları sayılmaz,
      böylece yığınlar arka plan refill'ini durdurmaz. */
  regular = 0;
  hots: Hot[] = [];
  private spriteFor: SpriteFactory;
  constructor(spriteFor: SpriteFactory) {
    this.spriteFor = spriteFor;
  }

  addPellet(x: number, y: number, v: number, c: string, delay: number, now: number, reg = false, fx = 0, ox = x, oy = y): void {
    const k = ckey(cellOf(x, FC), cellOf(y, FC));
    let a = this.cells.get(k);
    if (!a) {
      a = [];
      this.cells.set(k, a);
    }
    a.push({ x, y, v, c, r: pelR(v), ph: Math.random() * Math.PI * 2, born: now + (delay || 0), dead: false, spr: this.spriteFor(c), reg, fx, ox, oy });
    this.count++;
    if (reg) this.regular++;
  }

  newHot(): Hot {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * (WR - 500);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: rnd(110, 260) };
  }

  seedHots(n: number): void {
    for (let i = 0; i < n; i++) this.hots.push(this.newHot());
  }

  spawnRegular(now: number, instant: boolean): void {
    // Hücre-bazlı açık doldurma: birkaç aday üret, en boş hücredekini seç.
    // Botların süpürdüğü bölgeler böylece öncelikli dolar; saf uniform
    // dağılım boşlukları düzeltmez, ceset yığınlarının olduğu hücreler
    // zaten dolu görünüp elenir.
    let bx = 0;
    let by = 0;
    let bn = Infinity;
    for (let t = 0; t < 4; t++) {
      const [x, y] = this.pickSpot();
      const a = this.cells.get(ckey(cellOf(x, FC), cellOf(y, FC)));
      const n = a ? a.length : 0;
      if (n < bn) {
        bn = n;
        bx = x;
        by = y;
        if (n === 0) break;
      }
    }
    let x = bx;
    let y = by;
    if (x * x + y * y > (WR - 70) * (WR - 70)) {
      x *= 0.9;
      y *= 0.9;
    }
    const q = Math.random();
    const v = q < 0.7 ? 0.8 : q < 0.95 ? 1.6 : 3;
    this.addPellet(x, y, v, PAL[(Math.random() * PAL.length) | 0], instant ? -10 : 0, now, true);
  }

  private pickSpot(): [number, number] {
    if (Math.random() < 0.5 && this.hots.length > 0) {
      const h = this.hots[(Math.random() * this.hots.length) | 0];
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * h.r;
      return [h.x + Math.cos(a) * d, h.y + Math.sin(a) * d];
    }
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * (WR - 90);
    return [Math.cos(a) * d, Math.sin(a) * d];
  }
}

import { FC, WR } from '../utils/Constants.ts';
import { angDiff, cellOf, ckey, rnd } from '../utils/MathUtils.ts';
import type { Snake } from './Snake.ts';
import { createSnake } from './Snake.ts';
import { NAMES } from '../utils/Constants.ts';
import { skinCount } from './Skin.ts';
import type { FoodField, Hot } from './Food.ts';
import type { SnakeGrid } from '../systems/CollisionSystem.ts';

const OFFS = [0, 0.3, -0.3, 0.6, -0.6, 0.95, -0.95, 1.35, -1.35, 1.8, -1.8];

function danger(b: Snake, a: number, grid: SnakeGrid): number {
  let dg = 0;
  for (let k = 0; k < 2; k++) {
    const dist = k ? b.r * 5 + 120 : b.r * 2.4 + 38;
    const px = b.x + Math.cos(a) * dist;
    const py = b.y + Math.sin(a) * dist;
    const w = WR - Math.sqrt(px * px + py * py);
    if (w < 70) dg += ((70 - w) / 35) * (k ? 0.6 : 1);
    const c = grid.clearance(px, py, b.id) - b.r * (k ? 1.1 : 1.6) * b.caution;
    if (c < 70) dg += ((70 - c) / 70) * (k ? 0.7 : 1.3);
  }
  return dg;
}

function pickFood(b: Snake, food: FoodField, now: number): { x: number; y: number; dead: boolean; v: number } | null {
  const R2 = 520;
  const ix0 = cellOf(b.x - R2, FC);
  const ix1 = cellOf(b.x + R2, FC);
  const iy0 = cellOf(b.y - R2, FC);
  const iy1 = cellOf(b.y + R2, FC);
  let bp: { x: number; y: number; dead: boolean; v: number } | null = null;
  let bs = 0;
  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iy = iy0; iy <= iy1; iy++) {
      const a = food.cells.get(ckey(ix, iy));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const p = a[i];
        if (now < p.born) continue;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > R2 * R2) continue;
        const d = Math.sqrt(d2);
        const fw = Math.cos(angDiff(Math.atan2(dy, dx), b.ang));
        const sc = (p.v / (d + 80)) * (0.5 + 0.5 * (fw + 1) / 2);
        if (sc > bs) {
          bs = sc;
          bp = p;
        }
      }
    }
  }
  return bp;
}

export function thinkBot(b: Snake, snakes: Snake[], food: FoodField, hots: Hot[], now: number, grid: SnakeGrid): void {
  const hx = b.x;
  const hy = b.y;
  const d0 = Math.sqrt(hx * hx + hy * hy);
  let da = b.wander;
  let boost = false;
  b.wander += rnd(-0.35, 0.35);
  if (!b.tf || b.tf.dead || now > b.tfT) {
    b.tf = pickFood(b, food, now);
    b.tfT = now + rnd(0.8, 1.6);
  }
  if (b.tf) da = Math.atan2(b.tf.y - hy, b.tf.x - hx);
  else {
    if (!b.hot || Math.hypot(b.hot.x - hx, b.hot.y - hy) < 220) {
      b.hot = hots[(Math.random() * hots.length) | 0] ?? null;
    }
    if (b.hot) da = Math.atan2(b.hot.y - hy, b.hot.x - hx);
  }
  let thr: Snake | null = null;
  let thrD = 1e9;
  let prey: Snake | null = null;
  let preyD = 1e9;
  for (const o of snakes) {
    if (o === b || !o.alive) continue;
    const dx = o.x - hx;
    const dy = o.y - hy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (o.mass > b.mass * 1.25 && d < 420 + o.r * 4) {
      if (d < thrD) {
        thrD = d;
        thr = o;
      }
    } else if (b.aggr && o.mass * 1.2 < b.mass && d < 700) {
      if (d < preyD) {
        preyD = d;
        prey = o;
      }
    }
  }
  if (thr) {
    const away = Math.atan2(hy - thr.y, hx - thr.x);
    const toward = Math.cos(angDiff(thr.ang, away));
    if (thrD < 200 + thr.r * 3 || toward > 0.3) {
      da = away;
      if (thrD < 260) boost = true;
    }
  } else if (prey) {
    const lead = Math.min(preyD * 0.6, 300);
    const txp = prey.x + Math.cos(prey.ang) * lead;
    const typ = prey.y + Math.sin(prey.ang) * lead;
    da = Math.atan2(typ - hy, txp - hx);
    if (preyD < 400 && b.mass > 30 && Math.abs(angDiff(b.ang, da)) < 0.5) boost = true;
  }
  if (d0 > WR - 380) da = Math.atan2(-hy, -hx);
  let ba = da;
  let bs = -1e9;
  let bd = 0;
  for (const off of OFFS) {
    const a = b.ang + off;
    const dg = danger(b, a, grid);
    const sc = 2 * Math.cos(angDiff(a, da)) - dg * 3 - Math.abs(off) * 0.15;
    if (sc > bs) {
      bs = sc;
      ba = a;
      bd = dg;
    }
  }
  b.wang = ba;
  b.boost = boost && bd < 0.4;
}

export function findSpawnPos(snakes: Snake[]): { x: number; y: number } {
  let bx = 0;
  let by = 0;
  let bd = -1;
  for (let t = 0; t < 14; t++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * (WR * 0.72);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    let m = 1e9;
    for (const o of snakes) {
      if (!o.alive) continue;
      let dd = Math.hypot(o.x - x, o.y - y);
      if (dd < m) m = dd;
      for (let i = 0; i < o.bn; i += 3) {
        dd = Math.hypot(o.body[i * 2] - x, o.body[i * 2 + 1] - y);
        if (dd < m) m = dd;
      }
    }
    if (m > bd) {
      bd = m;
      bx = x;
      by = y;
    }
  }
  return { x: bx, y: by };
}

export function createBot(snakes: Snake[], initial: boolean): Snake {
  const p = findSpawnPos(snakes);
  const m = initial ? 10 + Math.pow(Math.random(), 3) * 900 : 10 + Math.pow(Math.random(), 4) * 200;
  return createSnake(
    NAMES[(Math.random() * NAMES.length) | 0],
    (Math.random() * skinCount()) | 0,
    true,
    m,
    p.x,
    p.y,
    Math.random() * Math.PI * 2,
  );
}

import { clamp, rnd } from '../utils/MathUtils.ts';
import { skinColorAt } from '../entities/Skin.ts';
import type { Snake } from '../entities/Snake.ts';

export interface DeathPellet {
  x: number;
  y: number;
  v: number;
  c: string;
  delay: number;
}

export function buildDeathPellets(s: Snake): DeathPellet[] {
  const total = s.mass * 0.8;
  let v = clamp(2 + s.mass / 250, 2, 14);
  let cnt = Math.round(total / v);
  if (cnt > 380) {
    cnt = 380;
    v = total / cnt;
  }
  if (cnt < 3) {
    cnt = 3;
    v = total / 3;
  }
  const out: DeathPellet[] = [];
  for (let j = 0; j < cnt; j++) {
    const idx = Math.min(s.bn - 1, Math.floor((j / cnt) * s.bn));
    const bx = idx < 0 ? s.x : s.body[idx * 2];
    const by = idx < 0 ? s.y : s.body[idx * 2 + 1];
    const col = skinColorAt(s.skin, Math.max(0, idx) + 1);
    out.push({
      x: bx + rnd(-s.r * 0.7, s.r * 0.7),
      y: by + rnd(-s.r * 0.7, s.r * 0.7),
      v: v * rnd(0.75, 1.25),
      c: col,
      delay: j * 0.004,
    });
  }
  return out;
}

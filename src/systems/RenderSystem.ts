import { TAU, mix, rgba } from '../utils/MathUtils.ts';
import { skinColorAt as storeColorAt, skinSpriteId } from '../entities/Skin.ts';
import { drawSpriteSnake, getSpriteSet } from './SpriteSkins.ts';
import { getSnakeFx, runSkinFx } from './SkinFx.ts';
import type { Snake } from '../entities/Snake.ts';
import { taperRatio } from '../entities/Snake.ts';
import { qGlow } from '../utils/settings.ts';

function mkc(w: number, h?: number): HTMLCanvasElement {
  const e = document.createElement('canvas');
  e.width = w;
  e.height = h ?? w;
  return e;
}

const SPR = new Map<string, HTMLCanvasElement>();

function segSprite(c: string): HTMLCanvasElement {
  const k = 's' + c;
  const hit = SPR.get(k);
  if (hit) return hit;
  const S = 64;
  const m = S / 2;
  const e = mkc(S);
  const x = e.getContext('2d')!;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, mix(c, [255, 255, 255], 0.24));
  g.addColorStop(0.55, c);
  g.addColorStop(0.9, mix(c, [0, 0, 0], 0.12));
  g.addColorStop(1, mix(c, [0, 0, 0], 0.34));
  x.fillStyle = g;
  x.beginPath();
  x.arc(m, m, m - 0.5, 0, TAU);
  x.fill();
  SPR.set(k, e);
  return e;
}

function glowSprite(c: string): HTMLCanvasElement {
  const k = 'g' + c;
  const hit = SPR.get(k);
  if (hit) return hit;
  const S = 64;
  const m = S / 2;
  const e = mkc(S);
  const x = e.getContext('2d')!;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, rgba(c, 0.75));
  g.addColorStop(0.45, rgba(c, 0.28));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  SPR.set(k, e);
  return e;
}

export function pelSprite(c: string): HTMLCanvasElement {
  const k = 'p' + c;
  const hit = SPR.get(k);
  if (hit) return hit;
  const S = 64;
  const m = S / 2;
  const e = mkc(S);
  const x = e.getContext('2d')!;
  let g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, rgba(c, 0.6));
  g.addColorStop(0.35, rgba(c, 0.22));
  g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  g = x.createRadialGradient(m - 3, m - 3, 1, m, m, 12);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.42, c);
  g.addColorStop(1, mix(c, [0, 0, 0], 0.3));
  x.fillStyle = g;
  x.beginPath();
  x.arc(m, m, 11.5, 0, TAU);
  x.fill();
  SPR.set(k, e);
  return e;
}

export function skinColorAt(skinIdx: number, bodyIndex: number): string {
  return storeColorAt(skinIdx, bodyIndex);
}

function drawEyes(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  ang: number,
  look: number,
): void {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const lc = Math.cos(look);
  const ls = Math.sin(look);
  for (const sg of [-1, 1]) {
    const ex = x + ca * r * 0.36 - sa * r * 0.52 * sg;
    const ey = y + sa * r * 0.36 + ca * r * 0.52 * sg;
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(ex, ey, r * 0.37, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.45)';
    c.lineWidth = Math.max(0.5, r * 0.06);
    c.stroke();
    c.fillStyle = '#0a0a14';
    c.beginPath();
    c.arc(ex + lc * r * 0.13, ey + ls * r * 0.13, r * 0.2, 0, TAU);
    c.fill();
  }
}

export function drawSnakeBody(
  cx: CanvasRenderingContext2D,
  s: Snake,
  z: number,
  vx0: number,
  vx1: number,
  vy0: number,
  vy1: number,
): void {
  const r = s.r;
  const b = s.body;
  const bn = s.bn;
  const vis = (x: number, y: number): boolean => x > vx0 && x < vx1 && y > vy0 && y < vy1;
  // Kalite düşükse glow geçişi tamamen atlanır (en pahalı kalemlerden);
  // ortada alfa yarıya iner. Canlı okunur: ayar anında işler.
  const gf = qGlow();
  if (gf > 0) {
    const ga = (0.12 + 0.42 * s.fx) * gf;
    const gs = r * (2.5 + 0.9 * s.fx);
    cx.globalAlpha = ga;
    for (let i = bn - 1; i >= 0; i -= 3) {
      const x = b[i * 2];
      const y = b[i * 2 + 1];
      if (vis(x, y)) {
        const col = skinColorAt(s.skin, i + 1);
        cx.drawImage(glowSprite(col), x - gs, y - gs, gs * 2, gs * 2);
      }
    }
    if (vis(s.x, s.y)) {
      cx.drawImage(glowSprite(skinColorAt(s.skin, 0)), s.x - gs, s.y - gs, gs * 2, gs * 2);
    }
    cx.globalAlpha = 1;
  }
  const spr = getSpriteSet(skinSpriteId(s.skin));
  if (spr) {
    drawSpriteSnake(cx, s, spr, vx0, vx1, vy0, vy1);
  } else {
    for (let i = bn - 1; i >= 0; i--) {
      const x = b[i * 2];
      const y = b[i * 2 + 1];
      if (!vis(x, y)) continue;
      const u = r * taperRatio(s, i);
      cx.drawImage(segSprite(skinColorAt(s.skin, i + 1)), x - u, y - u, u * 2, u * 2);
    }
    cx.drawImage(segSprite(skinColorAt(s.skin, 0)), s.x - r, s.y - r, r * 2, r * 2);
    drawEyes(cx, s.x, s.y, r, s.ang, s.wang);
    const fxc = getSnakeFx(s);
    if (fxc) runSkinFx(cx, s, fxc, vx0, vx1, vy0, vy1);
  }
  if (s.bot) {
    cx.font = '600 ' + 13 / Math.sqrt(z) + 'px "Exo 2","Segoe UI",system-ui,sans-serif';
    cx.textAlign = 'center';
    cx.fillStyle = 'rgba(255,255,255,.72)';
    cx.fillText(s.name, s.x, s.y + r + 16 / Math.sqrt(z));
  }
}

import { MIN_BOOST, V_BOOST, V_NORM } from '../utils/Constants.ts';
import { angDiff, clamp, lengthOf, radiusOf } from '../utils/MathUtils.ts';
import type { Snake } from '../entities/Snake.ts';

export function moveSnake(
  s: Snake,
  dt: number,
  dropPellet: (x: number, y: number, v: number, color: string) => void,
  boostColorFor: (bodyIndex: number) => string,
): void {
  const d = angDiff(s.wang, s.ang);
  const rate = 4.2 * Math.pow(9.6 / s.r, 0.55);
  const mt = rate * dt;
  s.ang += clamp(d, -mt, mt);
  s.boosting = s.boost && s.mass > MIN_BOOST;
  const tv = s.boosting ? V_BOOST : V_NORM;
  s.spd += (tv - s.spd) * Math.min(1, dt * 9);
  s.fx += ((s.boosting ? 1 : 0) - s.fx) * Math.min(1, dt * 7);
  const dist = s.spd * dt;
  s.x += Math.cos(s.ang) * dist;
  s.y += Math.sin(s.ang) * dist;
  s.tx.push(s.x);
  s.ty.push(s.y);
  if (s.boosting) {
    const dr = (2.8 + s.mass * 0.0045) * dt;
    s.mass -= dr;
    s.drainAcc += dr;
    if (s.drainAcc >= 1.2 && s.bn > 2) {
      s.drainAcc -= 1.2;
      const i = s.bn - 1;
      dropPellet(
        s.body[i * 2] + (Math.random() * 8 - 4),
        s.body[i * 2 + 1] + (Math.random() * 8 - 4),
        0.6,
        boostColorFor(i + 1),
      );
    }
  }
  s.r += (radiusOf(s.mass) - s.r) * Math.min(1, dt * 6);
  const target = lengthOf(s.mass);
  if (s.dlen < target) s.dlen = Math.min(target, s.dlen + dist * 0.6 + 0.2);
  // Boost'ta kütle eriyince ANINDA kısalıyordu (kuyruk patlaması). Büyüme
  // hızıyla simetrik yumuşak kısalma: görsel sıçrama yok, çarpışma boyu da
  // aynı karede değil birkaç karede uyum sağlar.
  else s.dlen = Math.max(target, s.dlen - dist * 0.6 - 0.5);
}

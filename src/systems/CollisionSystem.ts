import { SC } from '../utils/Constants.ts';
import { cellOf, ckey } from '../utils/MathUtils.ts';
import { buildBody, taperRatio } from '../entities/Snake.ts';
import type { Snake } from '../entities/Snake.ts';

export class SnakeGrid {
  cells = new Map<number, number[]>();
  // Kafa noktaları (kafa-kafa çiftleri için). build() ile tazelenir.
  private heads: Array<{ x: number; y: number; id: number; r: number }> = [];
  // Kare sayacı: kafa-kafa beraberliğinde deterministik seçim
  // (boy/skor ölçüt değil; build() her karede bir kez çalışır).
  private frame = 0;

  build(snakes: Snake[]): void {
    this.frame++;
    for (const a of this.cells.values()) a.length = 0;
    this.heads.length = 0;
    for (const s of snakes) {
      if (!s.alive) continue;
      buildBody(s);
      this.insert(s.x, s.y, s.id, s.r, 1);
      this.heads.push({ x: s.x, y: s.y, id: s.id, r: s.r });
      const b = s.body;
      for (let i = 0; i < s.bn; i++) {
        this.insert(b[i * 2], b[i * 2 + 1], s.id, s.r * taperRatio(s, i), 0);
      }
    }
  }

  private insert(x: number, y: number, id: number, r: number, head: number): void {
    const k = ckey(cellOf(x, SC), cellOf(y, SC));
    let a = this.cells.get(k);
    if (!a) {
      a = [];
      this.cells.set(k, a);
    }
    a.push(x, y, id, r, head);
  }

  clearance(px: number, py: number, id: number): number {
    let m = 1e9;
    const ix = cellOf(px, SC);
    const iy = cellOf(py, SC);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const a = this.cells.get(ckey(ix + dx, iy + dy));
        if (!a) continue;
        for (let j = 0; j < a.length; j += 5) {
          if (a[j + 2] === id) continue;
          const ex = a[j] - px;
          const ey = a[j + 1] - py;
          const d = Math.sqrt(ex * ex + ey * ey) - a[j + 3];
          if (d < m) m = d;
        }
      }
    }
    return m;
  }

  /**
   * Gövde teması (kafa noktaları hariç; onlar çift olarak ayrı çözülür).
   * Duvar nedeniyle ölen katil sayılmaz. Kafa-gövde davranışı eskisiyle aynı.
   */
  headHit(s: Snake, wallDead: Set<number>): number {
    const ix = cellOf(s.x, SC);
    const iy = cellOf(s.y, SC);
    const hr = s.r * 0.55;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const a = this.cells.get(ckey(ix + dx, iy + dy));
        if (!a) continue;
        for (let j = 0; j < a.length; j += 5) {
          if (a[j + 2] === s.id) continue;
          if (a[j + 4] === 1) continue;
          const killer = a[j + 2];
          if (wallDead.has(killer)) continue;
          const ex = a[j] - s.x;
          const ey = a[j + 1] - s.y;
          const rr = hr + a[j + 3] * 0.85;
          if (ex * ex + ey * ey < rr * rr) return killer;
        }
      }
    }
    return 0;
  }

  /**
   * Kafa-kafa çiftlerini çözer. Her çiftte tam bir ölen olur
   * (dönen harita: ölen id -> kazanan id).
   * Kural: hareket yönü (`ang`) diğer kafaya daha doğrudan bakan
   * (hız vektörü ile hedef yönün iç çarpımı büyük olan) ölür.
   * Tolerans (±0.02) içi eşitlikte kare sayacı + id'den deterministik
   * seçim yapılır; uzunluk/skor ölçüt değildir. Duvar-ölüleri katılmaz:
   * ne öldürürler ne de bu yüzden karşı taraf ölür.
   */
  resolvePairs(snakes: Snake[], wallDead: Set<number>): Map<number, number> {
    const out = new Map<number, number>();
    const dead = new Set<number>();
    const hs = this.heads.filter((h) => !wallDead.has(h.id));
    hs.sort((p, q) => p.id - q.id);
    const byId = new Map<number, Snake>();
    for (const s of snakes) {
      if (s.alive && !wallDead.has(s.id)) byId.set(s.id, s);
    }
    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const A = hs[i];
        const B = hs[j];
        if (dead.has(A.id) || dead.has(B.id)) continue;
        const sA = byId.get(A.id);
        const sB = byId.get(B.id);
        if (!sA || !sB) continue;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d2 = dx * dx + dy * dy;
        const rAB = A.r * 0.55 + B.r * 0.85;
        const rBA = B.r * 0.55 + A.r * 0.85;
        if (d2 >= rAB * rAB && d2 >= rBA * rBA) continue;
        const fA = Math.cos(sA.ang - Math.atan2(dy, dx));
        const fB = Math.cos(sB.ang - Math.atan2(-dy, -dx));
        let loser: number;
        let winner: number;
        if (Math.abs(fA - fB) <= 0.02) {
          if ((this.frame + A.id + B.id) % 2 === 0) { loser = A.id; winner = B.id; }
          else { loser = B.id; winner = A.id; }
        } else if (fA > fB) { loser = A.id; winner = B.id; }
        else { loser = B.id; winner = A.id; }
        dead.add(loser);
        out.set(loser, winner);
      }
    }
    return out;
  }
}

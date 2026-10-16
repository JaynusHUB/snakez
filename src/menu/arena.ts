// Oyunun canlı verisini okuyan tek kapı. Motor dosyalarına DOKUNMAZ; yalnızca
// `Game` üzerindeki zaten public alanları okur. Menü -> game yönlü tek
// bağımlılık budur, tersi yoktur (motor menüyü tanımaz).
import type { Game } from '../core/Game.ts';
import type { Snake } from '../entities/Snake.ts';

export interface LeaderRow {
  rank: number;
  name: string;
  score: number;
  mine: boolean;
}

/** İlk n hayattaki yılan, kütle sırasına göre. */
export function arenaTable(game: Game, n: number): LeaderRow[] {
  const alive: Snake[] = [];
  for (const s of game.snakes) if (s.alive) alive.push(s);
  alive.sort((a, b) => b.mass - a.mass);
  const rows: LeaderRow[] = [];
  for (let i = 0; i < alive.length && i < n; i++) {
    rows.push({
      rank: i + 1,
      name: alive[i].name,
      score: Math.floor(alive[i].mass),
      mine: alive[i] === game.me,
    });
  }
  return rows;
}

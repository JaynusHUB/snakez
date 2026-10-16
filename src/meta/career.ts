// Yaşam boyu istatistikler (`snakez.career`). Saf mantık, DOM yok.
//
// Her ölümde meta katmanı (Meta.death) buradan kaydeder; oyun motoruna
// dokunulmaz. Son 20 oyunla sınırlıdır, save_data şişmez. Misafir için de
// yerelde tutulur; bulut senkronu mevcut anahtarlarla aynı yoldan gider
// (CLOUD_KEYS içinde), ek kural gerekmez.
export interface CareerGame {
  /** Unix ms. */
  t: number;
  /** Skor. */
  s: number;
  /** Süre (sn). */
  d: number;
  /** Eleme. */
  k: number;
  /** En iyi sıra. */
  r: number;
}

export interface Career {
  v: 1;
  /** Toplam eleme. */
  kills: number;
  /** Toplam oynama süresi (sn). */
  playSecs: number;
  /** En uzun hayatta kalma (sn). */
  longest: number;
  /** En iyi sıra (küçük = iyi; 0 = yok). */
  bestRank: number;
  /** Toplam kazanılan coin. */
  coins: number;
  /** Toplam skor. */
  totalScore: number;
  /** En yüksek tek oyun skoru. */
  bestScore: number;
  /** Tek oyunda en çok eleme. */
  bestKills: number;
  /** Yerelde ilk görülme (Unix ms; 0 = bilinmiyor). Misafir üyelik satırı. */
  firstSeen: number;
  /** Son oynanan yerel gün (YYYY-MM-DD; '' = yok). */
  lastDay: string;
  /** Günlük oyun serisi (gün). */
  streak: number;
  /** En uzun seri (gün). */
  bestStreak: number;
  /** Açılan başarımlar: id → açılma tarihi (Unix ms). Bir kez açılan kapanmaz. */
  ach: Record<string, number>;
  /** Son 20 oyun, yeniden eskiye. */
  games: CareerGame[];
}

export const CAREER_KEY = 'snakez.career';
const MAX_GAMES = 20;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function blank(): Career {
  return { v: 1, kills: 0, playSecs: 0, longest: 0, bestRank: 0, coins: 0, totalScore: 0, bestScore: 0, bestKills: 0, firstSeen: 0, lastDay: '', streak: 0, bestStreak: 0, ach: {}, games: [] };
}

/** Eski kayıtlardaki rekorlardan başlangıç (iki kopyanın büyüğü). */
function seedBest(): number {
  let b = 0;
  try {
    for (const k of ['snakez.best', 'snakez.meta.best']) {
      const n = Number(localStorage.getItem(k));
      if (Number.isFinite(n) && n > 0) b = Math.max(b, Math.floor(n));
    }
  } catch {
    /* gizli mod */
  }
  return b;
}

function validGame(g: unknown): g is CareerGame {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  return o.t !== undefined && o.s !== undefined && o.d !== undefined && o.k !== undefined && o.r !== undefined
    && [o.t, o.s, o.d, o.k, o.r].every((x) => typeof x === 'number' && Number.isFinite(x) && (x as number) >= 0);
}

function validAch(a: unknown): Record<string, number> {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(a as Record<string, unknown>)) {
    if (typeof k === 'string' && k.length > 0 && k.length <= 40 && typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[k] = Math.floor(v);
    }
  }
  return out;
}

function validDay(d: unknown): string {
  return typeof d === 'string' && DAY_RE.test(d) ? d : '';
}

/** Yerel takvim günü (YYYY-MM-DD). Yaz saati kaymalarına karşı metin bazlı. */
export function localDay(d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Ham JSON'dan kariyer (depo okumaz; tohum atmaz). Bozuksa boş döner. */
export function parseCareer(raw: string | null): Career {
  const c = blank();
  if (raw === null) return c;
  try {
    const p = JSON.parse(raw) as Partial<Career>;
    if (!p || typeof p !== 'object') return c;
    c.kills = num(p.kills);
    c.playSecs = num(p.playSecs);
    c.longest = num(p.longest);
    c.bestRank = num(p.bestRank);
    c.coins = num(p.coins);
    c.totalScore = num(p.totalScore);
    c.bestScore = num(p.bestScore);
    c.bestKills = num(p.bestKills);
    c.firstSeen = num(p.firstSeen);
    c.lastDay = validDay(p.lastDay);
    c.streak = num(p.streak);
    c.bestStreak = num(p.bestStreak);
    c.ach = validAch(p.ach);
    if (Array.isArray(p.games)) {
      c.games = p.games.filter(validGame).map((g) => ({
        t: Math.floor(g.t), s: Math.floor(g.s), d: Math.floor(g.d), k: Math.floor(g.k), r: Math.floor(g.r),
      })).slice(0, MAX_GAMES);
    }
    return c;
  } catch {
    return c;
  }
}

/** Kariyeri okur. Anahtar yoksa/bozuksa varsayılanlarla devam eder (hata yok).
 *  firstSeen yoksa ilk açılışta yazılır (misafir üyelik satırı). */
export function loadCareer(): Career {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CAREER_KEY);
  } catch {
    return blank();
  }
  if (raw === null) {
    const c = blank();
    c.bestScore = seedBest();
    c.firstSeen = Date.now();
    store(c);
    return c;
  }
  const c = parseCareer(raw);
  c.bestScore = Math.max(c.bestScore, seedBest());
  if (!c.firstSeen) {
    c.firstSeen = Date.now();
    store(c);
  }
  return c;
}

/** Kariyeri yazar (dışa açık; birleştirme sonrası kayıt için). */
export function saveCareer(c: Career): void {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(c));
  } catch {
    /* kota dolu veya gizli mod — oyun yine oynanır */
  }
}

function store(c: Career): void {
  saveCareer(c);
}

/** Dünün yerel günü (YYYY-MM-DD). */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDay(d);
}

/** Bir oyunu işler, yazar ve güncel kariyeri döner. */
export function recordCareerGame(g: { score: number; kills: number; secs: number; bestRank: number; coins: number }): Career {
  const c = loadCareer();
  const secs = Math.max(0, Math.floor(g.secs));
  const score = Math.max(0, Math.floor(g.score));
  const kills = Math.max(0, Math.floor(g.kills));
  c.kills += kills;
  c.playSecs += secs;
  if (secs > c.longest) c.longest = secs;
  const r = Math.max(0, Math.floor(g.bestRank));
  if (r > 0 && (c.bestRank === 0 || r < c.bestRank)) c.bestRank = r;
  if (kills > c.bestKills) c.bestKills = kills;
  c.coins += Math.max(0, Math.floor(g.coins));
  c.totalScore += score;
  if (score > c.bestScore) c.bestScore = score;
  // Oyun serisi: aynı gün sabit, dün +1, daha eski 1'e sıfırla.
  const today = localDay();
  if (!c.lastDay) {
    c.lastDay = today;
    if (c.streak < 1) c.streak = 1;
  } else if (c.lastDay === today) {
    if (c.streak < 1) c.streak = 1;
  } else if (c.lastDay === yesterday()) {
    c.streak += 1;
  } else {
    c.streak = 1;
  }
  c.lastDay = today;
  if (c.streak > c.bestStreak) c.bestStreak = c.streak;
  c.games.unshift({ t: Date.now(), s: score, d: secs, k: kills, r });
  if (c.games.length > MAX_GAMES) c.games.length = MAX_GAMES;
  store(c);
  return c;
}

/**
 * Çakışma BİRLEŞTİRMESİ — yalnızca başarım ve seri alanları için.
 * Coin/XP/skin'e dokunulmaz (kazanan taraf aynen kalır). Kurallar:
 * başarım listeleri birleşir (tarih olarak eskisi kalır), bestKills ve
 * bestStreak'in büyüğü, firstSeen'in eskisi, streak'te tarihi yeni taraf.
 */
export function mergeCareer(base: Career, extra: Career): Career {
  const ach: Record<string, number> = {};
  for (const [k, v] of Object.entries(extra.ach)) ach[k] = v;
  for (const [k, v] of Object.entries(base.ach)) {
    ach[k] = ach[k] === undefined ? v : Math.min(ach[k], v);
  }
  return {
    ...base,
    ach,
    bestKills: Math.max(base.bestKills, extra.bestKills),
    bestStreak: Math.max(base.bestStreak, extra.bestStreak),
    firstSeen: base.firstSeen && extra.firstSeen
      ? Math.min(base.firstSeen, extra.firstSeen)
      : base.firstSeen || extra.firstSeen,
    lastDay: extra.lastDay > base.lastDay ? extra.lastDay : base.lastDay,
    streak: extra.lastDay > base.lastDay ? extra.streak : base.streak,
  };
}

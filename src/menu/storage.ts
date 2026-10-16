// Menü katmanının kalıcı verisi. Oyun kodundan bağımsız; localStorage okuma
// yazma işlemlerini tek yerde toplar (Safari gizli modunda localStorage
// erişimi atabilir, bu yüzden her çağrı korumalı).
import { NAMES } from '../utils/Constants.ts';

const KEY = {
  name: 'snakez.name',
  best: 'snakez.best',
  games: 'snakez.games',
  skin: 'snakez.skin',
} as const;

/** Oyuncunun adının en fazla kaç karakter olabileceği. */
export const NAME_MAX = 14;

let lastPick = '';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* kota dolu veya gizli mod — oyun yine oynanır, kayıt yapılmaz */
  }
}

/** Depodaki değeri güvenli bir tam sayıya çevirir. Bozuk veri 0 olur. */
function readInt(key: string): number {
  const raw = read(key);
  if (raw === null) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** ASCII kontrol karakterleri; isimde anlamları yok. */
const CTRL = new RegExp(String.raw`[\u0000-\u001f\u007f]`, 'g');

/**
 * İsim girişini temizler: kontrol karakterleri ve fazla boşluk atılır,
 * uzunluk NAME_MAX ile sınırlanır. Boş kalırsa null döner.
 */
export function cleanName(raw: string): string | null {
  const s = raw.replace(CTRL, ' ').replace(/\s+/g, ' ').trim();
  return s.length ? s.slice(0, NAME_MAX) : null;
}

/** Bot havuzundan yeni bir isim seçer; art arda aynı isim gelmesin diye
 *  son seçimi tekrar etmez. */
function rollName(): string {
  let pick = '';
  for (let i = 0; i < 12; i++) {
    pick = NAMES[(Math.random() * NAMES.length) | 0];
    if (pick !== lastPick) break;
  }
  lastPick = pick;
  return pick;
}

interface Profile {
  name: string;
  best: number;
  games: number;
  skin: number;
}

/** Kayıtlı profili okur. İsim hiç kaydedilmemişse havuzdan bir tane seçip
 *  hemen saklar, böylece isim her açılışta değişmez. `skin` motorun kendi
 *  SKIN_DEFS dizisine clamp edilir; bozuk bir değer oyunu bozmaz. */
export function loadProfile(skinCount: number): Profile {
  const saved = read(KEY.name);
  const name = (saved && cleanName(saved)) || rollName();
  if (name !== saved) write(KEY.name, name);
  // skinCount 0/defensif: NaN üretmeden 0'a düş.
  const raw = skinCount > 0 ? readInt(KEY.skin) % skinCount : 0;
  const skin = raw;
  // İlk açılışta da yaz: vitrine ile oyun aynı görünümle açılsın.
  if (read(KEY.skin) === null) write(KEY.skin, String(skin));
  return { name, best: readInt(KEY.best), games: readInt(KEY.games), skin };
}

export function saveName(name: string): void {
  write(KEY.name, name);
}

export function saveSkin(skin: number): void {
  write(KEY.skin, String(Math.max(0, Math.floor(skin))));
}

/** Bir hayat bittiğinde çağrılır. Skor rekoru kırarsa best güncellenir.
 *  Dönen değer o turda rekor kırılıp kırılmadığını söyler (rozet için). */
export function commitRun(score: number): boolean {
  const best = readInt(KEY.best);
  write(KEY.games, String(readInt(KEY.games) + 1));
  if (score > best) {
    write(KEY.best, String(Math.floor(score)));
    return true;
  }
  return false;
}

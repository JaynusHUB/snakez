// Bulut kayıt katmanı — Supabase `public.profiles` tablosu. DOM yok, saf mantık.
//
// Kurallar (güvenlik):
//   1. Bulut OKUNMADAN ASLA YAZILMAZ (`ready` bayrağı). Yükleme başarısızsa
//      kaydetme durur; boş/düşük yerel veri dolu bulutu ezemez.
//   2. Misafirken (kullanıcı yok) hiçbir istek atılmaz.
//   3. Çakışma: buluttaki `updated_at` bilinenden yeniyse üstüne yazılmaz,
//      `onCloudConflict` ile arayüze sorulur.
//   4. Motor (Game.ts) ve localStorage ŞEMASI bu dosyaya dokunulmaz; yalnızca
//      mevcut anahtarlar okunur/yazılır.
//   5. Son başarılı senkron işareti (`snakez.sync`: uid + updated_at + imza)
//      cihazda saklanır. Menü reload'ları sonrası karar localde verilir:
//      bulut işaretten oynamamış + yerel değişmişse sessiz yaz, bulut yeniyse
//      ve yerel dokunulmamışsa sessiz indir; ikisi de değişmişse sor.
//      İşaret cihaz-yerelidir, buluta ASLA yazılmaz.
import { getClient } from './supabaseClient.ts';
import { levelOf } from '../meta/views.ts';

/** save_data şeması sürümü. Yükselirse eski istemci üstüne yazmaz. */
export const CLOUD_SCHEMA = 1;

/** Bulutta tutulan anahtarlar. Cihaz ayarları (fx/quality/fps) BİLEREK yok. */
export const CLOUD_KEYS = [
  'snakez.name',
  'snakez.best',
  'snakez.games',
  'snakez.skin',
  'snakez.meta',
  'snakez.meta.best',
  'snakez.chest',
  'snakez.career',
] as const;

export interface ProgSum {
  level: number;
  coins: number;
  xp: number;
  best: number;
  games: number;
  own: number;
}

export type CloudStatus = 'ok' | 'saving' | 'offline' | 'error' | 'conflict';

export interface CloudRow {
  id: string;
  display_name: string;
  coins: number;
  xp: number;
  level: number;
  save_data: { v: number; keys: Record<string, string | null> };
  save_version: number;
  updated_at: string;
}

const DEBOUNCE_MS = 4000;

let uid: string | null = null;
let ready = false;
let dirty = false;
let saving = false;
let timer = 0;
let lastRemote: string | null = null;
let lastPushSig = '';
let status: CloudStatus = 'ok';
let statusCb: ((s: CloudStatus) => void) | null = null;
let conflictCb: ((row: CloudRow) => void) | null = null;

export function onCloudStatus(cb: (s: CloudStatus) => void): void {
  statusCb = cb;
}
export function onCloudConflict(cb: (row: CloudRow) => void): void {
  conflictCb = cb;
}
function setStatus(s: CloudStatus): void {
  status = s;
  try {
    statusCb?.(s);
  } catch {
    /* gösterim hatası senkronu durdurmaz */
  }
}
export function cloudStatusNow(): CloudStatus {
  return status;
}

/** Oturum bağlanır; okuma yapılana kadar yazma kapalı kalır. */
export function cloudBind(id: string): void {
  const changed = uid !== id;
  uid = id;
  if (changed) {
    ready = false;
    dirty = false;
    lastRemote = null;
    lastPushSig = '';
  }
  // İşareti geri yükle: menü reload'ları sonrası karar localde verilir.
  // (İşaret yoksa/başka kullanıcıysa boş kalır, ilk-giriş yolu çalışır.)
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SyncMarker>;
      if (p && typeof p === 'object' && p.uid === id && typeof p.updatedAt === 'string' && p.updatedAt && typeof p.sig === 'string') {
        lastRemote = p.updatedAt;
        lastPushSig = p.sig;
      }
    }
  } catch {
    /* bozuk işaret yok sayılır */
  }
}
export function cloudUnbind(): void {
  uid = null;
  ready = false;
  dirty = false;
  window.clearTimeout(timer);
}
/** Bulut okundu/satır kuruldu: artık yazılabilir. */
export function cloudSetReady(v: boolean): void {
  ready = v;
}
export function cloudIsReady(): boolean {
  return ready;
}
/** Yerel ile bulut eşitlendi işareti (gereksiz push önlenir). */
export function cloudMarkSynced(): void {
  lastPushSig = snapshotSig();
  dirty = false;
  persistMarker();
}

const SYNC_KEY = 'snakez.sync';

/** Son başarılı senkron işareti. Cihaz-yerel; buluta yazılmaz, yedeklenmez. */
export interface SyncMarker {
  v: 1;
  uid: string;
  updatedAt: string;
  sig: string;
}

/** İşareti oku. Başka kullanıcıya aitse veya bozuksa null. */
export function loadSyncMarker(): SyncMarker | null {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SyncMarker>;
    if (!p || typeof p !== 'object') return null;
    if (typeof p.uid !== 'string' || !p.uid || p.uid !== uid) return null;
    if (typeof p.updatedAt !== 'string' || !p.updatedAt) return null;
    if (typeof p.sig !== 'string') return null;
    return { v: 1, uid: p.uid, updatedAt: p.updatedAt, sig: p.sig };
  } catch {
    return null;
  }
}

/** İşareti sil (çıkış / sıfırdan başla: eski imza yeniyi ezmesin). */
export function clearSyncMarker(): void {
  try {
    localStorage.removeItem(SYNC_KEY);
  } catch {
    /* gizli mod */
  }
}

function persistMarker(): void {
  if (!uid || !lastRemote) return;
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ v: 1, uid, updatedAt: lastRemote, sig: lastPushSig }));
  } catch {
    /* gizli mod */
  }
}

/**
 * İki ISO zaman damgası aynı ana mı? (ms duyarlı.)
 * PostgREST timestamptz'i `...+00:00` / mikrosaniye biçiminde döndürebilir;
 * ham string karşılaştırması aynı anı farklı sanırdı. Parse edilemeyen
 * değerde güvenli taraf seçilir (eşit DEĞİL sayılır).
 */
export function isSameInstant(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return ta === tb;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}
function numStr(v: string | null): number {
  if (v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Yerel bulut-anahtarlarının ham fotoğrafı (olduğu gibi, parse yok). */
export function snapshotLocal(): Record<string, string | null> {
  const o: Record<string, string | null> = {};
  for (const k of CLOUD_KEYS) o[k] = read(k);
  return o;
}

/** Değişiklik yakalama imzası (5 sn yoklaması için). */
export function snapshotSig(): string {
  const parts: string[] = [];
  for (const k of CLOUD_KEYS) parts.push(read(k) ?? '');
  return parts.join('~');
}

function sumOf(keys: Record<string, string | null>): ProgSum {
  let coins = 0, xp = 0, own = 0;
  try {
    const m = JSON.parse(keys['snakez.meta'] || '{}') as { coins?: unknown; xp?: unknown; own?: unknown };
    coins = num(m.coins);
    xp = num(m.xp);
    own = Array.isArray(m.own) ? m.own.length : 0;
  } catch {
    /* bozuk kayıt: sıfır sayılır */
  }
  return { level: levelOf(xp).level, coins, xp, best: numStr(keys['snakez.best']), games: numStr(keys['snakez.games']), own };
}

export function summarizeLocal(): ProgSum {
  return sumOf(snapshotLocal());
}

export function summarizeRow(r: CloudRow): ProgSum {
  const keys = r.save_data?.keys ?? {};
  const xp = num(r.xp);
  let coins = num(r.coins), own = 0;
  try {
    const m = JSON.parse(keys['snakez.meta'] || '{}') as { coins?: unknown; own?: unknown };
    if (!coins) coins = num(m.coins);
    own = Array.isArray(m.own) ? m.own.length : 0;
  } catch {
    /* sütun değerleri kullanılır */
  }
  // Rekorun iki kopyası var (best: menü/tele, meta.best: ölüm ekranı).
  // Karşılaştırma menüdeki ana kopyayla yapılır, diğeri yedektir.
  const best = numStr(keys['snakez.best'] ?? null) || numStr(keys['snakez.meta.best'] ?? null);
  return { level: levelOf(xp).level, coins, xp, best, games: numStr(keys['snakez.games'] ?? null), own };
}

/** Hiç ilerleme yok sayılır (adı sayılmaz: isim her zaman vardır). */
export function isBlank(s: ProgSum): boolean {
  return s.coins === 0 && s.xp === 0 && s.best === 0 && s.own === 0;
}

export function sameProgress(a: ProgSum, b: ProgSum): boolean {
  return a.level === b.level && a.coins === b.coins && a.xp === b.xp && a.best === b.best && a.own === b.own;
}

/** Yerel bulut-anahtarlarını ham haliyle yedekler (`snakez.backup.<zaman>`). */
export function backupLocal(reason: string): void {
  try {
    localStorage.setItem(`snakez.backup.${Date.now()}`, JSON.stringify({ reason, keys: snapshotLocal() }));
    const olds: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('snakez.backup.')) olds.push(k);
    }
    olds.sort().reverse();
    for (const k of olds.slice(3)) localStorage.removeItem(k);
  } catch {
    /* gizli mod */
  }
}

/** Ham anahtarları yerele yazar (buluttan indirme). */
export function writeLocal(keys: Record<string, string | null>): void {
  for (const k of CLOUD_KEYS) {
    try {
      const v = keys[k];
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* gizli mod */
    }
  }
}

/** Bulut-anahtarlarını yerelden siler (çıkışta gizlilik). Cihaz ayarları kalır. */
export function clearCloudLocal(): void {
  for (const k of CLOUD_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* gizli mod */
    }
  }
}

/** Değişiklik biriktirir (debounce ~4 sn). Misafir/yüklenmemişken sessiz. */
export function cloudTouch(): void {
  if (!uid) return;
  dirty = true;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void flush(), DEBOUNCE_MS);
}

/** Gönderilmemiş değişiklik var mı? */
export function cloudHasPending(): boolean {
  if (!uid) return false;
  return dirty || snapshotSig() !== lastPushSig;
}

/** Hemen kaydet. Başarısızlıkta false (sebep statüde). */
export async function cloudSaveNow(timeoutMs = 10000): Promise<boolean> {
  window.clearTimeout(timer);
  if (!uid || !ready) return false;
  try {
    return await withTimeout(flush(), timeoutMs);
  } catch {
    return false;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t = 0;
  const gate = new Promise<T>((_, rej) => {
    t = window.setTimeout(() => rej(new Error('timeout')), ms);
  });
  return Promise.race([p, gate]).finally(() => window.clearTimeout(t)) as Promise<T>;
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

async function flush(): Promise<boolean> {
  if (!uid || !ready || saving) return false;
  // Temiz durum: yazacak bir şey yok — ağa hiç çıkma (menü geçişleri bedava).
  if (!dirty && lastRemote && snapshotSig() === lastPushSig) return true;
  if (offline()) {
    setStatus('offline');
    return false;
  }
  const c = getClient();
  if (!c) return false;
  saving = true;
  setStatus('saving');
  try {
    // Çakışma kontrolü: başkası (öbür sekme) daha yeni yazmış mı?
    // limit(1) bilerek: satır yoksa 200 + boş dizi döner, 406 gürültüsü yok.
    // Satır hiç yoksa çakışma değil: upsert kurar.
    const pre = await c.from('profiles').select('updated_at,save_version').eq('id', uid).limit(1);
    if (pre.error) throw pre.error;
    const prior = (pre.data as Array<{ updated_at: string; save_version: number }> | null)?.[0];
    if (!prior) return await writeRow();
    const sv = typeof prior.save_version === 'number' ? prior.save_version : 0;
    if (sv > CLOUD_SCHEMA) return await conflicted();
    // Bilinmeyen/kanıtlanamayan durumda güvenli taraf: sor, ezme.
    if (!lastRemote || !isSameInstant(prior.updated_at, lastRemote)) return await conflicted();
    return await writeRow();
  } catch {
    setStatus(offline() ? 'offline' : 'error');
    return false;
  } finally {
    saving = false;
  }
}

/** Başarılı yazışın defteri: işaret + imza + statü birlikte güncellenir. */
function markPushed(updatedAt: string): void {
  lastRemote = updatedAt;
  lastPushSig = snapshotSig();
  dirty = false;
  persistMarker();
  setStatus('ok');
}

async function writeRow(): Promise<boolean> {
  const c = getClient();
  if (!c || !uid) return false;
  const keys = snapshotLocal();
  const sum = sumOf(keys);
  const now = new Date().toISOString();
  const row = {
    id: uid,
    display_name: (read('snakez.name') || 'Oyuncu').slice(0, 40),
    coins: sum.coins,
    xp: sum.xp,
    level: sum.level,
    save_data: { v: CLOUD_SCHEMA, keys },
    save_version: CLOUD_SCHEMA,
    updated_at: now,
  };
  const up = await c.from('profiles').upsert(row, { onConflict: 'id' });
  if (up.error) throw up.error;
  markPushed(now);
  return true;
}

/** Zorla yaz (kullanıcı çakışmayı bile isteye çözdü / ilk aktarma). */
export async function cloudPushNow(): Promise<boolean> {
  window.clearTimeout(timer);
  if (!uid || !ready || saving) return false;
  if (offline()) {
    setStatus('offline');
    return false;
  }
  if (!getClient()) return false;
  saving = true;
  setStatus('saving');
  try {
    return await writeRow();
  } catch {
    setStatus(offline() ? 'offline' : 'error');
    return false;
  } finally {
    saving = false;
  }
}

/**
 * Karşılaştır-ve-yaz: bulut, verilen işaretten farklıysa YAZMADAN false
 * döner (çakışma diyaloğu conflicted() üzerinden açılır). Sessiz devam yolu;
 * "aynı cihazda oynamaya devam" bu koldan sessizce buluta çıkar.
 */
export async function cloudPushStrict(expectedUpdatedAt: string): Promise<boolean> {
  window.clearTimeout(timer);
  if (!uid || !ready || saving) return false;
  if (offline()) {
    setStatus('offline');
    return false;
  }
  const c = getClient();
  if (!c) return false;
  saving = true;
  setStatus('saving');
  try {
    const pre = await c.from('profiles').select('updated_at,save_version').eq('id', uid).limit(1);
    if (pre.error) throw pre.error;
    const prior = (pre.data as Array<{ updated_at: string; save_version: number }> | null)?.[0];
    if (!prior) return await writeRow(); // satır arada silinmiş: yeniden kur
    const sv = typeof prior.save_version === 'number' ? prior.save_version : 0;
    if (sv > CLOUD_SCHEMA) return await conflicted();
    if (!isSameInstant(prior.updated_at, expectedUpdatedAt)) return await conflicted();
    return await writeRow();
  } catch {
    setStatus(offline() ? 'offline' : 'error');
    return false;
  } finally {
    saving = false;
  }
}

async function conflicted(): Promise<boolean> {
  const c = getClient();
  setStatus('conflict');
  ready = false; // kullanıcı karar verene kadar yazma durur
  if (c && uid) {
    try {
      const full = await c.from('profiles').select('*').eq('id', uid).limit(1);
      if (full.error) return false;
      const row = (full.data as CloudRow[] | null)?.[0];
      if (row) {
        conflictCb?.(row);
        return false;
      }
      // Satır arada silinmiş: ezecek bir şey yok, güvenle yaz.
      return await writeRow();
    } catch {
      /* satır alınamazsa statü zaten conflict */
    }
  }
  return false;
}

/** Bulut satırını oku. Yazma izni vermez (ready ayrı açılır). */
export async function cloudLoad(): Promise<{ kind: 'empty' } | { kind: 'row'; row: CloudRow } | { kind: 'error' }> {
  const c = getClient();
  if (!c || !uid) return { kind: 'error' };
  try {
    // limit(1) bilerek: satır yoksa 200 + boş dizi döner (406 yok, gürültü yok).
    const r = await c.from('profiles').select('*').eq('id', uid).limit(1);
    if (r.error) return { kind: 'error' };
    const row = (r.data as CloudRow[] | null)?.[0];
    if (!row) {
      lastRemote = null;
      return { kind: 'empty' }; // yeni hesap: hata değil
    }
    lastRemote = row.updated_at;
    return { kind: 'row', row };
  } catch {
    return { kind: 'error' };
  }
}

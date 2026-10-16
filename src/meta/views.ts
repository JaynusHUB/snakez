import { DEAL_PCT, RARITY, SHOP_FRAMES, SHOP_FX, SHOP_NAMES, SHOP_SKINS, basePrice, fxById, nameOf, priceFor, type Rarity } from './catalog.ts';
import { hasDeathFx } from '../systems/DeathFx.ts';
import { ACHIEVEMENTS, ACH_TOTAL } from './achieve.ts';
import type { AchCtx } from './achieve.ts';
// Saf görünüm üreticileri + seviye matematiği. DOM/oyun bağımlılığı yok;
// oyun (meta.ts) ve bağımsız önizleme aynı fonksiyonları kullanır.
export const MAX_LEVEL = 500;
/** L → L+1 için gereken XP. */
export const need = (l: number): number => Math.round(60 + 14 * l + 0.03 * l * l);

export const TIERS: Array<[number, string, string]> = [
  [1, 'Çaylak', '#9fb3c8'], [10, 'Avcı', '#4ee063'], [30, 'Gölge', '#2be7ff'],
  [60, 'Usta', '#9d5cff'], [100, 'Efsane', '#ffb02e'], [200, 'Titan', '#ff4650'],
  [350, 'Mitik', '#ff5cf0'], [500, 'Snakez Tanrısı', '#fff3a0'],
];
export const tier = (l: number) => [...TIERS].reverse().find((t) => l >= t[0])!;
export const nextTier = (l: number) => TIERS.find((t) => t[0] > l) ?? null;

export interface Lv { level: number; into: number; span: number }
export function levelOf(total: number): Lv {
  let l = 1, xp = total;
  while (l < MAX_LEVEL && xp >= need(l)) { xp -= need(l); l++; }
  return l >= MAX_LEVEL ? { level: l, into: 1, span: 1 } : { level: l, into: xp, span: need(l) };
}
export const totalFor = (level: number): number => { let t = 0; for (let l = 1; l < level; l++) t += need(l); return t; };

export const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const fmt = (n: number): string => Math.round(n).toLocaleString('tr-TR');
export const pct = (lv: Lv): number => Math.min(100, (lv.into / lv.span) * 100);

const I = (d: string, vb = 24) => `<svg class="ic" viewBox="0 0 ${vb} ${vb}" aria-hidden="true" focusable="false">${d}</svg>`;
export const ICON = {
  coin: I('<circle cx="12" cy="12" r="9" fill="#ffd35c"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#a86b00" stroke-width="1.6"/><path d="M12 8.2v7.6M9.6 10.2h3.6a1.3 1.3 0 010 2.6h-2.4a1.3 1.3 0 000 2.6h3.6" fill="none" stroke="#a86b00" stroke-width="1.4" stroke-linecap="round"/>'),
  crown: I('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/>'),
  skull: I('<path d="M12 3a8 8 0 00-8 8c0 2.6 1.2 4.3 3 5.4V20h3v-2h4v2h3v-3.6c1.8-1.1 3-2.8 3-5.4a8 8 0 00-8-8zM8.7 13.6a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2zm6.6 0a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2z" fill="currentColor"/>'),
  target: I('<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></g>'),
  clock: I('<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/></g>'),
  trophy: I('<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.6 11M17 6h3v1.5A3.5 3.5 0 0116.4 11M12 14v4m-4 2h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  rank: I('<path d="M5 20V10m7 10V4m7 16v-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  bolt: I('<path d="M13 2L5 13.5h6L10 22l9-12.5h-6z" fill="currentColor"/>'),
  lock: I('<path d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
  chest: I('<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 9a4 4 0 014-4h8a4 4 0 014 4v2H4z"/><rect x="4" y="11" width="16" height="9" rx="1.5"/><path d="M12 8v5" stroke-linecap="round"/><circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none"/></g>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  user: I('<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.4-3.4 4-5 7-5s5.6 1.6 7 5"/></g>'),
};

const SHIELD = 'M32 4L54 12V32C54 46 44 56 32 60C20 56 10 46 10 32V12Z';
const HEX = 'M32 4L56 18V46L32 60L8 46V18Z';
/** Rütbeye göre şekli değişen rozet: daire → altıgen → kalkan → kanatlı → dikenli → taçlı. */
export function badge(level: number): string {
  const i = TIERS.indexOf(tier(level));
  const body = i === 0 ? '<circle cx="32" cy="32" r="27"/>' : `<path d="${i < 3 ? HEX : SHIELD}"/>`;
  const extra = i === 4 ? '<path d="M10 20L-8 10L-2 30L10 34ZM54 20L72 10L66 30L54 34Z"/>'
    : i === 5 ? '<path d="M20 12L25-3L31 10L32-5L33 10L39-3L44 12Z"/>'
    : i >= 6 ? '<path d="M16 14L22 2L28 11L32-3L36 11L42 2L48 14Z"/>' : '';
  const n = i >= 2 ? Math.min(i - 1, 5) : 0;
  const pips = Array.from({ length: n }, (_, k) => `<circle cx="${32 + (k - (n - 1) / 2) * 7}" cy="52" r="2"/>`).join('');
  const d = String(level).length;
  return `<svg class="bd t${i}" viewBox="-10 -6 84 72" aria-hidden="true" focusable="false"><g class="bd-x">${extra}</g><g class="bd-b">${body}</g><g class="bd-g">${body}</g><g class="bd-p">${pips}</g><text x="32" y="36" text-anchor="middle" font-size="${d >= 3 ? 19 : d === 2 ? 24 : 28}">${level}</text></svg>`;
}

/** İlerleme halkası + rütbe rozeti. */
let FRAME = '', NCOL = '';
/** Market'ten takılan çerçeve / isim rengi (meta.ts ayarlar). */
export const setLook = (frame: string, name: string): void => { FRAME = frame; NCOL = name; };
/** Animasyonlu isim renkleri: id → CSS sınıfı. */
export const ANIM: Record<string, string> = { rainbow: 'rb', inferno: 'nf', gold: 'gd' };
/** Katmanlı (ekstra eleman isteyen) çerçeveler. */
const MULTI = ['neon', 'orbit', 'prism', 'gold', 'aurora', 'snake', 'ice', 'magma'];
export const ring = (lv: Lv, size = '', frame = FRAME): string =>
  `<div class="mt-ring ${size} ${frame ? 'fr-' + frame : ''}" style="--p:${pct(lv).toFixed(1)};--tier:${tier(lv.level)[2]}" data-ring>${MULTI.includes(frame) ? '<i class="fx"></i><i class="fx fx2"></i>' : ''}${badge(lv.level)}</div>`;

// ── HUD ──────────────────────────────────────────────────────────────
export const hudShell = (): string => `
  <div class="mt-lv" data-lv></div>
  <aside class="mt-lbc" aria-label="Canlı liderlik">
    <h3>${ICON.crown}<span>LİDERLİK</span><i class="live"></i><small data-cnt></small></h3>
    <ol class="mt-lb" data-lb></ol><p class="mt-lbf" data-lbf></p>
  </aside>
  <div class="mt-score" data-sc></div>
  <div class="mt-pops" data-pops aria-hidden="true"></div>`;

export const xpText = (lv: Lv): string => {
  const n = nextTier(lv.level);
  return lv.level >= MAX_LEVEL ? 'MAKS SEVİYE' : `${fmt(lv.into)} / ${fmt(lv.span)} XP${n ? ` · ${n[1]}'a ${n[0] - lv.level} sv.` : ''}`;
};

export function lvHTML(lv: Lv, coins: number, run = 0): string {
  return `${ring(lv)}<div class="mt-lvtxt"><span class="mt-tn">${tier(lv.level)[1]} · Sv ${lv.level}</span>
    <div class="mt-bar"><i data-bar style="width:${pct(lv)}%"></i></div><small data-xpt>${xpText(lv)}</small></div>
    <div class="mt-side"><span class="mt-coin">${ICON.coin}${fmt(coins)}</span><span class="mt-run" data-run>+${fmt(run)} XP</span></div>`;
}

/** Menüdeyken görünen profil çipi: rozet + coin + sandık + Market + giriş. */
export interface AuthPill {
  mode: 'guest' | 'user';
  name?: string;
  avatar?: string;
  email?: string;
}
export function pfHTML(lv: Lv, coins: number, chestReady: boolean, chestTitle: string, auth: AuthPill, sync: { text: string; st: string } | null): string {
  const pill = auth.mode === 'user'
    ? `<button class="pf-user" data-authmenu type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Hesap">${auth.avatar
      ? `<img src="${esc(auth.avatar)}" alt="" referrerpolicy="no-referrer" />`
      : `<i class="pf-init" aria-hidden="true">${esc((auth.name ?? '?').trim().charAt(0).toUpperCase() || '?')}</i>`
    }<span>${esc(auth.name ?? 'Oyuncu')}</span></button>
    <div class="au-menu" data-aumenu hidden role="menu"><p>${esc(auth.email || auth.name || '')}</p><button data-act="profile" type="button" role="menuitem">Profilim</button><button data-act="signout" type="button" role="menuitem">Çıkış yap</button></div>`
    : `<button class="pf-auth" data-act="auth" type="button"><span class="au-ic" aria-hidden="true">${ICON.user}</span><span class="au-tx">Giriş yap</span></button><small class="au-guest">Misafir · ilerleme bu tarayıcıda</small>`;
  return `<button class="pf-id" data-act="prog" type="button" aria-label="İlerleme">${ring(lv, 'sm')}<span><b>${tier(lv.level)[1]}</b><small>Seviye ${lv.level} · ${fmt(lv.into)} XP</small></span></button>
    <span class="mt-coin">${ICON.coin}${fmt(coins)}</span><button class="pf-chest${chestReady ? ' ready' : ''}" data-act="chest" type="button" aria-label="Günlük sandık" title="${esc(chestTitle)}">${ICON.chest}<i class="dot" aria-hidden="true"></i></button><button class="pf-shop" data-act="shop" type="button">MARKET</button>${pill}${sync ? `<button class="au-sync" data-act="sync" type="button" data-st="${esc(sync.st)}" title="Bulut kaydı"><i aria-hidden="true"></i><span>${esc(sync.text)}</span></button>` : ''}`;
}

// ── Giriş ──────────────────────────────────────────────────────────────
// Marketin kardeşi: aynı kart, aynı neon kenar, aynı başlık dili.
// Durumlar: unconfigured (anahtar yok) · guest · loading · error · user.
const GOOGLE_G = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.3-2.1 3.8-5.1 3.8-8.5z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-3.8 3C3.4 21.4 7.4 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4L1.4 6.8C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.8-2.5z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.3l3.8 3c1-2.6 3.7-4.6 6.8-4.6z"/></svg>';

export interface AuthView {
  status: 'unconfigured' | 'guest' | 'loading' | 'error' | 'user';
  userName: string;
  userAvatar: string;
  userEmail: string;
  skinName: string;
  skinColor: string;
  level: number;
  coins: number;
}

export function authHTML(v: AuthView): string {
  const off = v.status === 'unconfigured';
  const busy = v.status === 'loading';
  const google = v.status === 'user'
    ? `<div class="au-user">${v.userAvatar
      ? `<img src="${esc(v.userAvatar)}" alt="" referrerpolicy="no-referrer" />`
      : `<i class="pf-init" aria-hidden="true">${esc(v.userName.trim().charAt(0).toUpperCase() || '?')}</i>`
    }<div><b>${esc(v.userName)}</b><small>${esc(v.userEmail)}</small></div></div>
    <button class="au-guest-btn" data-auth-signout type="button">Çıkış yap</button>`
    : `<button class="au-google" data-auth-google type="button"${off || busy ? ' disabled' : ''}>${busy ? '<i class="au-spin" aria-hidden="true"></i>' : GOOGLE_G}<span>${busy ? 'Bağlanıyor…' : 'Google ile devam et'}</span></button>
    ${v.status === 'error' ? '<p class="au-err" role="alert">Giriş yapılamadı, tekrar dene.</p>' : ''}
    ${off ? '<p class="au-off">Şu an giriş yapılamıyor</p>' : ''}
    <button class="au-guest-btn" data-auth-guest type="button">Misafir olarak devam et</button>`;
  return `<div class="mt-card au"><header><div><h2 id="mt-autht">GİRİŞ</h2><p class="mt-note">Coinlerin ve skinlerin kaybolmasın.</p></div><button class="mt-x" data-close type="button" aria-label="Kapat">✕</button></header>
    <div class="au-prev"><span class="au-dot" style="--c:${esc(v.skinColor)}" aria-hidden="true"></span><div><b>${esc(v.skinName)}</b><small>Seviye ${v.level} · ${fmt(v.coins)} coin</small></div></div>
    ${google}
    <ul class="au-perks"><li>${ICON.check}<span>Her cihazdan devam et</span></li><li>${ICON.check}<span>Çerezleri silsen de kaybolmaz</span></li><li>${ICON.check}<span>Coin ve skinler bulutta</span></li></ul>
    <p class="au-fine">Devam ederek <a href="/gizlilik.html" target="_blank" rel="noopener">Gizlilik Politikası</a>'nı kabul etmiş olursun.</p></div>`;
}

// ── Bulut aktarma / seçim ────────────────────────────────────────────
// Giriş modalının kardeşi: aynı kart (.mt-card.au), aynı buton dili.
// Coinler ASLA birleştirilmez; kullanıcı bir tarafı seçer.
export interface SideSum {
  title: string;
  sub: string;
  dot: string;
}
export interface MigrateView {
  heading: string;
  note: string;
  local: SideSum | null;
  remote: SideSum | null;
  primaryLabel: string;
  primaryAct: string;
  secondaryLabel: string;
  secondaryAct: string;
}

function sideRow(s: SideSum): string {
  return `<div class="au-prev"><span class="au-dot" style="--c:${esc(s.dot)}" aria-hidden="true"></span><div><b>${esc(s.title)}</b><small>${esc(s.sub)}</small></div></div>`;
}

export function migrateHTML(v: MigrateView): string {
  return `<div class="mt-card au"><header><div><h2 id="mt-autht">${esc(v.heading)}</h2><p class="mt-note">${esc(v.note)}</p></div><button class="mt-x" data-close type="button" aria-label="Kapat">✕</button></header>
    ${v.local ? sideRow(v.local) : ''}
    ${v.remote ? sideRow(v.remote) : ''}
    <button class="au-google" data-mig="${esc(v.primaryAct)}" type="button"><span>${esc(v.primaryLabel)}</span></button>
    <button class="au-guest-btn" data-mig="${esc(v.secondaryAct)}" type="button">${esc(v.secondaryLabel)}</button></div>`;
}

// ── Günlük sandık ────────────────────────────────────────────────────
// Kapalı sandık (AÇ beklenir), süre bekleyen sandık ya da açılmış ödül.
// Ödül dalı: sandık KAPALI başlar, fazları orkestratör (chestfx.ts) işletir;
// ödül metni ilk andan DOM'dadır (animasyon yarıda kesse de ödül bellidir).
// Rarity: coin (altın, sakin) / nadir (yeşil) / epik (mor, en yoğun).
export interface ChestPoolItem { label: string; rarity: string; share: string }
export interface ChestBd { rest: string; epik: string; restN: number; epikN: number; specials: Array<{ label: string; w: number; share: string }> }
export function chestHTML(reward: { label: string; color: string; rarity: 'coin' | 'nadir' | 'epik'; coins: number } | null, streak: number, countdown: string, canOpen: boolean, lucky: boolean, pool: ChestPoolItem[], bd: ChestBd): string {
  const box = (): string => `<div class="ch-box" aria-hidden="true">
    <svg viewBox="0 0 160 120">
      <defs>
        <linearGradient id="chWd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f5c28"/><stop offset=".55" stop-color="#6a3f17"/><stop offset="1" stop-color="#432508"/></linearGradient>
        <linearGradient id="chWl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a06a30"/><stop offset=".6" stop-color="#7a4a1c"/><stop offset="1" stop-color="#5a3412"/></linearGradient>
        <linearGradient id="chGd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b57a14"/><stop offset=".35" stop-color="#ffe9a0"/><stop offset=".62" stop-color="#e8b132"/><stop offset="1" stop-color="#a06a10"/></linearGradient>
        <radialGradient id="chIn" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe6"/><stop offset=".5" style="stop-color:var(--rc,#ffd35c)"/><stop offset="1" stop-color="#2a1604"/></radialGradient>
      </defs>
      <ellipse cx="80" cy="117" rx="62" ry="6" fill="rgba(0,0,0,.28)"/>
      <rect x="14" y="52" width="132" height="62" rx="8" fill="url(#chWd)"/>
      <path d="M16 72H144M16 92H144" stroke="rgba(0,0,0,.28)" stroke-width="1.6"/>
      <path d="M16 54H144" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>
      <ellipse class="ch-in" cx="80" cy="54" rx="58" ry="7.5" fill="url(#chIn)"/>
      <rect x="30" y="52" width="13" height="62" fill="url(#chGd)"/><rect x="117" y="52" width="13" height="62" fill="url(#chGd)"/>
      <g fill="#6b4208"><circle cx="36.5" cy="62" r="2"/><circle cx="36.5" cy="104" r="2"/><circle cx="123.5" cy="62" r="2"/><circle cx="123.5" cy="104" r="2"/></g>
      <rect x="14" y="107" width="132" height="8" rx="5" fill="url(#chGd)" opacity=".8"/>
      <path d="M66 60h28a5 5 0 015 5v14a8 8 0 01-8 8H69a8 8 0 01-8-8V65a5 5 0 015-5z" fill="url(#chGd)" stroke="#7a4d0a" stroke-width="1.2"/>
      <circle cx="80" cy="73" r="4.2" fill="#3a2208"/><rect x="78" y="73" width="4" height="9" rx="1.6" fill="#3a2208"/>
    </svg>
    <div class="ch-sheen" aria-hidden="true"></div><div class="ch-seamglow" aria-hidden="true"></div>
    <svg class="ch-lid" viewBox="0 0 160 120" aria-hidden="true">
      <defs><clipPath id="chLc"><path d="M14 60V40C14 21 30 10 54 10H106C130 10 146 21 146 40V60Z"/></clipPath></defs>
      <path d="M14 60V40C14 21 30 10 54 10H106C130 10 146 21 146 40V60Z" fill="url(#chWl)"/>
      <g clip-path="url(#chLc)">
        <path d="M10 28C40 22 120 22 150 28M10 44H150" stroke="rgba(0,0,0,.25)" stroke-width="1.6" fill="none"/>
        <rect x="30" y="8" width="13" height="54" fill="url(#chGd)"/><rect x="117" y="8" width="13" height="54" fill="url(#chGd)"/>
        <path d="M20 24C30 15 44 12 60 12H100" stroke="rgba(255,255,255,.24)" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>
      <rect x="12" y="52" width="136" height="9" rx="3.5" fill="url(#chGd)"/>
      <path d="M72 50h16v10a4 4 0 01-4 4h-8a4 4 0 01-4-4z" fill="url(#chGd)" stroke="#7a4d0a" stroke-width="1.1"/>
    </svg>
    <div class="ch-leak" aria-hidden="true"></div>
  </div>`;
  // Saf süs katmanları (aria-hidden): zemin ışığı + sızan ışıktan yükselen kıvılcımlar.
  // Gösterim/animasyon CSS'te data-view'e bağlıdır; efekt kapalıyken statik kalır.
  const ambience = `<div class="ch-floor" aria-hidden="true"></div><div class="ch-motes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
  const gem = '<svg class="ch-gem" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6z" fill="currentColor"/></svg>';
  const head = (t: string): string =>
    `<header class="ch-hd"><h2 id="mt-cht">${t}</h2><button class="mt-x" data-close type="button" aria-label="Kapat">✕</button></header>`;
  const prize = (): string => `<div class="ch-prize" aria-hidden="true">
    <div class="ch-coin3d"><svg viewBox="0 0 76 76"><defs><linearGradient id="chCg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="#ffd35c"/><stop offset="1" stop-color="#e09a14"/></linearGradient></defs>
      <circle cx="38" cy="38" r="35" fill="url(#chCg)"/><circle cx="38" cy="38" r="35" fill="none" stroke="#a86b00" stroke-opacity=".55" stroke-width="2"/><circle cx="38" cy="38" r="26" fill="none" stroke="#a86b00" stroke-width="3.2"/>
      <g transform="translate(38 38) scale(2.5) translate(-12 -12)" fill="none" stroke="#a86b00" stroke-width="1.4" stroke-linecap="round"><path d="M12 8.2v7.6M9.6 10.2h3.6a1.3 1.3 0 010 2.6h-2.4a1.3 1.3 0 000 2.6h3.6"/></g></svg></div>
    <div class="ch-tile"><svg viewBox="0 0 76 76"><path d="M38 8C40 27 49 36 68 38C49 40 40 49 38 68C36 49 27 40 8 38C27 36 36 27 38 8Z" style="fill:var(--ic,#8fd3ff)"/><circle cx="58" cy="17" r="3.4" fill="#fff"/><circle cx="17" cy="58" r="2.6" fill="#fff" opacity=".8"/></svg></div>
  </div>`;
  const odds = (pool: Array<{ label: string; rarity: string; share: string }>, bd: { rest: string; epik: string; restN: number; epikN: number; specials: Array<{ label: string; w: number; share: string }> }): string => {
    const coinPct = pool.length ? 62 : 100;
    // Dağılım şeridi: satırlardaki aynı değerlerden türetilir, yalnızca görsel özet (metin yok).
    const nadirT = bd.specials.reduce((a, sp) => a + sp.w, 0) + bd.restN * parseFloat(bd.rest);
    const epikT = bd.epikN * parseFloat(bd.epik);
    const strip = ([['coin', coinPct], ['big', 10], ['nadir', nadirT], ['epik', epikT]] as Array<[string, number]>)
      .filter(([, v]) => v > 0).map(([k, v]) => `<i class="s-${k}" style="flex:${v.toFixed(1)} 1 0"></i>`).join('');
    return `<div class="ch-odds">
    <p class="ch-odds-t">${ICON.chest}SANDIK İÇERİĞİ</p>
    <div class="ch-strip" aria-hidden="true">${strip}</div>
    <div class="ch-odd ch-odd-top t-coin"><span>Coin <small>25-60 + seri bonusu</small></span><div class="ch-bar"><i style="width:${coinPct}%"></i></div><b>%${coinPct}</b></div>
    <div class="ch-odd t-big"><span>Büyük Coin <small>1.000-10.000</small></span><div class="ch-bar"><i style="width:10%"></i></div><b>%10</b></div>
    ${bd.specials.map((sp) => `<div class="ch-odd t-nadir"><span>${esc(sp.label)}</span><div class="ch-bar"><i style="width:${Math.max(sp.w, 1.5)}%"></i></div><b>${sp.share}</b></div>`).join('')}
    ${bd.restN ? `<div class="ch-odd t-nadir"><span>Diğer Nadir <small>${bd.restN} ürün</small></span><div class="ch-bar"><i style="width:${bd.rest}%"></i></div><b>%${bd.rest.replace('.', ',')}</b></div>` : ''}
    ${bd.epikN ? `<div class="ch-odd t-epik"><span>Epik <small>${bd.epikN} ürün</small></span><div class="ch-bar"><i style="width:${bd.epik}%"></i></div><b>%${bd.epik.replace('.', ',')}</b></div>` : ''}
    <p class="ch-odds-n">Seri bonusu +5 coin/gün (en fazla +25).${pool.length ? ' Tüm kozmetiklere sahipsen 80 coin verilir.' : ' Tüm kozmetiklere sahipsin — bu sandıktan 80 coin çıkar.'}</p>
    ${pool.length ? `<details class="ch-pool"><summary>${pool.length} ürünün şansını gör</summary><ul>${pool.map((c) => `<li class="rar-${c.rarity}">${esc(c.label)}<em>${c.rarity === 'epik' ? 'EPİK' : 'NADİR'}</em><u>${c.share}</u></li>`).join('')}</ul></details>` : ''}</div>`;
  };
  if (reward) {
    const rc = reward.rarity === 'coin' ? '#ffd35c' : reward.rarity === 'nadir' ? RARITY.nadir.color : RARITY.epik.color;
    // Uzun isimler asla kesilmez: karakter sayısına göre 4 kademe (n1..n4), taşarsa satır kırılır.
    const nlen = [...reward.label].length;
    const nsz = reward.rarity === 'coin' ? 'is-num' : nlen <= 11 ? 'n1' : nlen <= 16 ? 'n2' : nlen <= 24 ? 'n3' : 'n4';
    const got = reward.rarity === 'coin'
      ? `<b><span data-count>0</span> <span class="unit">Coin</span></b>`
      : esc(reward.label);
    return `<div class="mt-card ch" data-phase="idle" data-rar="${reward.rarity}" style="--rc:${rc};--ic:${reward.color}">
    <div class="ch-edge" aria-hidden="true"></div>
    ${head('SANDIK AÇILDI')}
    <div class="ch-stage"><div class="ch-rw"><div class="ch-rays"></div></div><div class="ch-rw2"><div class="ch-rays2"></div></div>
      <div class="ch-halo"></div><div class="ch-beam"></div><div class="ch-ring"></div><div class="ch-ring r2"></div>
      ${ambience}${box()}${prize()}</div>
    <div class="ch-txt">
      <div class="ch-res" role="status" aria-live="polite">
        <span class="ch-pill ch-rar">${gem}${reward.rarity === 'coin' ? 'GÜNLÜK COIN' : reward.rarity === 'nadir' ? 'NADİR' : 'EPİK'}</span>
        <p class="ch-amt ch-got ${nsz}">${got}</p>
        <div class="ch-meta">${streak >= 3 ? `<span class="ch-seri ch-streak">SERİ x${streak}</span>` : ''}${reward.rarity === 'coin' ? '' : '<span class="ch-eq">Otomatik kuşanıldı</span>'}</div>
        <div class="ch-subs"><p class="ch-sub">${ICON.clock}<span>Sonraki sandık: <b>${esc(countdown)}</b></span></p><p class="ch-sub">${ICON.bolt}<span>Yarın gelirsen seri <b>${streak + 1} gün</b> olur.</span></p></div>
      </div>
    </div>
    <div class="ch-act"><div class="ch-row"><button class="k" data-close type="button">Kapat</button><button class="m" data-act="shop" type="button">Market</button></div></div></div>`;
  }
  if (!canOpen) {
    return `<div class="mt-card ch" data-phase="idle"><div class="ch-edge" aria-hidden="true"></div>
    ${head('GÜNLÜK SANDIK')}
    <div class="ch-stage"><div class="ch-rw"><div class="ch-rays"></div></div><div class="ch-halo"></div>${ambience}${box()}</div>
    <div class="ch-txt"><div class="ch-wait"><p class="ch-sub">${ICON.clock}<span>Sonraki sandık: <b>${esc(countdown)}</b></span></p>${streak > 1 ? `<p class="ch-sub">${ICON.bolt}<span>Seri: <b>${streak} gün</b> — yarın gelirsen devam eder.</span></p>` : ''}</div></div>
    <div class="ch-act"><div class="ch-row"><button class="k" data-close type="button">Kapat</button>${lucky ? `<button class="m" data-lucky type="button">Şanslı Sandık · 100 coin</button>` : ''}</div></div>${odds(pool, bd)}</div>`;
  }
  return `<div class="mt-card ch" data-phase="idle"><div class="ch-edge" aria-hidden="true"></div>
    ${head('GÜNLÜK SANDIK')}
    <div class="ch-stage"><div class="ch-rw"><div class="ch-rays"></div></div><div class="ch-halo"></div><div class="ch-beam"></div>${ambience}${box()}</div>
    <div class="ch-txt"><p class="ch-sub ch-hint">${streak > 0 ? `${ICON.bolt}<span>Seri: <b>${streak} gün</b> — her gün gel, bonus büyüsün.</span>` : '<span>Her gün bedava coin ya da kozmetik.</span>'}</p></div>
    <div class="ch-act"><button class="ch-open" data-chest-open type="button">AÇ</button></div>${odds(pool, bd)}</div>`;
}

export interface Row { name: string; mass: number; me: boolean; rank: number }
export function lbHTML(rows: Row[], mine: Row | null): string {
  const top = rows[0]?.mass || 1;
  // Faz: liste ~8Hz yeniden kurulduğu için animasyonlar her seferinde
  // 0'dan başlardı. Tek faz tüm satırlara yazılır, CSS negatif gecikmeyle
  // kaldığı yerden devam eder (imza/değişken adı değişmedi).
  const ph = (performance.now() / 1000).toFixed(2);
  const li = (r: Row, extra = '') =>
    `<li class="${r.me ? 'me' : ''} ${r.me && NCOL ? 'nc' + (ANIM[NCOL] ? ' ' + ANIM[NCOL] : '') : ''} r${r.rank} ${extra}" style="--w:${Math.max(4, (r.mass / top) * 100).toFixed(0)}%${r.me && NCOL && !ANIM[NCOL] ? ';--nc:' + NCOL : ''};--ph:${ph}"><em>${r.rank}</em><span data-t="${esc(r.name)}">${esc(r.name)}</span><b>${fmt(r.mass)}</b></li>`;
  return rows.map((r) => li(r)).join('') + (mine ? li(mine, 'gap') : '');
}

export function scoreHTML(score: number, kills: number, secs: number, rank: number, total: number): string {
  const t = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
  return `<div class="main"><small>SKOR</small><b>${fmt(score)}</b></div>
    <div><small>SIRA</small><b>#${rank}<u>/${total}</u></b></div>
    <div><small>ELEME</small><b>${kills}</b></div><div><small>SÜRE</small><b>${t}</b></div>`;
}

// ── Ölüm ekranı ──────────────────────────────────────────────────────
export interface Death {
  killer: string | null; score: number; best: number; isBest: boolean; kills: number; secs: number; bestRank: number;
  parts: Array<[string, number]>; xp: number; coins: number; xMul: boolean; cMul: boolean;
  before: Lv; after: Lv; tierUp: string | null; series: number[];
  /** Giriş yapılmamışsa ölüm ekranında küçük hatırlatma satırı. */
  authNudge: boolean;
}

export function spark(s: number[]): string {
  if (s.length < 2) s = [10, 10];
  const mx = Math.max(...s), W = 220, H = 52;
  const pts = s.map((v, i) => `${((i / (s.length - 1)) * W).toFixed(1)},${(H - 4 - (v / mx) * (H - 10)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2be7ff" stop-opacity=".35"/><stop offset="1" stop-color="#2be7ff" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,${H} ${pts} ${W},${H}" fill="url(#sg)"/><polyline points="${pts}" fill="none" stroke="#2be7ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

export function deathHTML(d: Death): string {
  const up = d.after.level - d.before.level, t = tier(d.after.level);
  const cell = (ic: string, l: string, v: string) => `<div>${ic}<small>${l}</small><b>${v}</b></div>`;
  const secs = `${Math.floor(d.secs / 60)}:${String(Math.floor(d.secs % 60)).padStart(2, '0')}`;
  return `<div class="dv" style="--tier:${t[2]}">
  <section class="dv-l">
    <p class="dv-eye">${ICON.skull}${d.killer ? `<span><b>${esc(d.killer)}</b> seni yakaladı</span>` : '<span>Arena sınırına çarptın</span>'}</p>
    <h2 id="mt-ot">OYUN BİTTİ</h2>
    <div class="dv-score"><small>SKOR</small><b data-n="${d.score}">0</b>
      ${d.isBest ? `<span class="dv-new">${ICON.trophy}YENİ REKOR</span>` : `<span class="dv-pct">Rekorun %${Math.round((d.score / Math.max(1, d.best)) * 100)}'i</span>`}</div>
    <div class="dv-spark"><small>KÜTLE GRAFİĞİ</small>${spark(d.series)}</div>
    <div class="dv-grid">${cell(ICON.target, 'ELEME', String(d.kills))}${cell(ICON.clock, 'SÜRE', secs)}${cell(ICON.rank, 'EN İYİ SIRA', '#' + d.bestRank)}${cell(ICON.trophy, 'REKOR', fmt(Math.max(d.best, d.score)))}</div>
  </section>
  <section class="dv-r">
    <div class="dv-lvl">${ring(d.after, 'lg')}<div><span class="mt-tn">${t[1]}</span><h3>Seviye ${d.after.level}</h3>
      <div class="mt-bar"><i data-bar="${pct(d.after)}" style="width:${pct(d.before)}%"></i></div>
      <small>${d.after.level >= MAX_LEVEL ? 'MAKS SEVİYE' : `${fmt(d.after.into)} / ${fmt(d.after.span)} XP`}</small></div></div>
    ${up > 0 ? `<p class="dv-up">${ICON.bolt}<span>SEVİYE ATLADIN <b>${d.before.level} → ${d.after.level}</b>${d.tierUp ? `<em>Yeni rütbe: ${d.tierUp}</em>` : ''}</span></p>` : ''}
    <ul class="dv-xp">${d.parts.map(([l, v]) => `<li><span>${l}</span><b>+${fmt(v)}</b></li>`).join('')}
      ${d.xMul ? '<li class="mul"><span>2× XP çarpanı</span><b>aktif</b></li>' : ''}</ul>
    <div class="dv-tot"><div><small>TOPLAM XP</small><b class="xp" data-n="${d.xp}">+0</b></div>
      <div><small>COIN${d.cMul ? ' · 2×' : ''}</small><b class="co" data-n="${d.coins}">+0</b>${ICON.coin}</div></div>
    ${d.authNudge ? `<div class="dv-auth" data-auth-nudge><span>İlerlemeni kaybetme, giriş yap</span><button data-act="auth" type="button">Giriş yap</button><button data-auth-x type="button" aria-label="Kapat">✕</button></div>` : ''}
  </section>
  <footer class="dv-act"><button class="mt-cta" data-act="retry" type="button">TEKRAR OYNA <kbd>Enter</kbd></button>
    <button data-act="prog" type="button">İlerleme</button><button data-act="shop" type="button">Market</button><button data-act="menu" type="button">Menü</button></footer></div>`;
}

// ── Profilim ─────────────────────────────────────────────────────────
// Marketin kardeşi: aynı kart, neon kenar, harf aralıklı başlık; iç sekmeler
// market sekmeleri (.mk-tabs), istatistik kartları ölüm ekranı (.dv-grid),
// trend grafiği ölüm ekranı (.dv-spark + spark). Başkasının profili yok.
export type ProfTab = 'genel' | 'basarim' | 'koleksiyon' | 'gecmis';

export interface CollRow {
  label: string;
  have: number;
  total: number;
}

export interface ProfileView {
  tab: ProfTab;
  name: string;
  avatar: string;
  guest: boolean;
  lv: Lv;
  best: number;
  games: number;
  kills: number;
  playSecs: number;
  longest: number;
  bestRank: number;
  coins: number;
  totalScore: number;
  bestKills: number;
  /** Üyelik satırı için zaman damgası (ms; 0 = gösterme). */
  memberTs: number;
  streak: number;
  bestStreak: number;
  coll: CollRow[];
  hist: Array<{ t: number; s: number; d: number; k: number; r: number }>;
  ach: Record<string, number>;
  achCtx: AchCtx;
}

/** sn → "45 sn" / "12 dk" / "3 sa 5 dk" / "2 gün". */
function fmtDur(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} sn`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} sa ${m % 60} dk`;
  return `${Math.floor(h / 24)} gün`;
}

/** Zaman damgası → "az önce" / "5 dk önce" / "2 sa önce" / "3 gün önce". */
function ago(t: number): string {
  const m = Math.floor(Math.max(0, Date.now() - t) / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** Zaman damgası → "Ekim 2026'den beri oyuncu" (0 = gösterme). */
function memberLine(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const m = TR_MONTHS[d.getMonth()];
  const vowels = [...m.toLocaleLowerCase('tr')].reverse().find((c) => 'aeıioöuü'.includes(c)) ?? 'a';
  const suf = 'eiöü'.includes(vowels) ? "'den" : "'dan";
  return `${m} ${d.getFullYear()}${suf} beri oyuncu`;
}

/** Unix ms → "11 Ekim 2026" (başarım açılma tarihi). */
function dateLine(ts: number): string {
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function profileHTML(v: ProfileView): string {
  const t = tier(v.lv.level);
  const initial = esc(v.name.trim().charAt(0).toUpperCase() || '?');
  const tabs: Array<[ProfTab, string]> = [['genel', 'GENEL'], ['basarim', 'BAŞARIMLAR'], ['koleksiyon', 'KOLEKSİYON'], ['gecmis', 'GEÇMİŞ']];
  const idx = Math.max(0, tabs.findIndex(([k]) => k === v.tab));
  const cell = (ic: string, l: string, val: string) => `<div>${ic}<small>${l}</small><b>${val}</b></div>`;
  const mem = memberLine(v.memberTs);
  let body = '';
  if (v.tab === 'genel') {
    const g = v.games;
    const avg = (n: number): string => (g > 0 ? fmt(Math.round(n / g)) : '—');
    body = `${mem || v.streak > 0 || v.bestStreak > 0 ? `<div class="prf-mem">${mem ? `<span>${ICON.user}${esc(mem)}</span>` : ''}<span>${ICON.bolt}Seri: ${v.streak} gün · En uzun: ${v.bestStreak} gün</span></div>` : ''}
    <div class="dv-grid">${cell(ICON.trophy, 'REKOR SKOR', fmt(v.best))}${cell(ICON.rank, 'TOPLAM OYUN', fmt(v.games))}${cell(ICON.target, 'TOPLAM ELEME', fmt(v.kills))}${cell(ICON.clock, 'TOPLAM SÜRE', fmtDur(v.playSecs))}${cell(ICON.bolt, 'EN UZUN', fmtDur(v.longest))}${cell(ICON.crown, 'EN İYİ SIRA', v.bestRank > 0 ? '#' + v.bestRank : '—')}${cell(ICON.coin, 'TOPLAM COIN', fmt(v.coins))}</div>
    <p class="prf-sec">ORTALAMALAR</p>
    <div class="dv-grid">${cell(ICON.trophy, 'ORT SKOR', avg(v.totalScore))}${cell(ICON.clock, 'ORT SÜRE', g > 0 ? fmtDur(v.playSecs / g) : '—')}${cell(ICON.target, 'ORT ELEME', g > 0 ? (v.kills / g).toFixed(1).replace('.', ',') : '—')}${cell(ICON.skull, 'EN ÇOK ELEME', fmt(v.bestKills))}${cell(ICON.crown, 'EN YÜKSEK SKOR', fmt(v.best))}</div>
    <button class="au-guest-btn" data-act="prog" type="button">Rütbe yolu →</button>`;
  } else if (v.tab === 'basarim') {
    const open = ACHIEVEMENTS.filter((d) => v.ach[d.id]);
    const pctAll = Math.round((open.length / ACH_TOTAL) * 100);
    body = `<div class="ach-sum"><b>${open.length}/${ACH_TOTAL} açıldı</b><div class="mt-bar"><i style="width:${pctAll}%"></i></div></div>
    <ul class="ach">${ACHIEVEMENTS.map((d) => {
      const ts = v.ach[d.id];
      const rc = RARITY[d.rarity];
      const badge = `<span class="rar ach-rar" style="--r:${rc.color}">${rc.label}</span>`;
      const icon = `<span class="ach-ic" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" focusable="false">${d.icon}</svg></span>`;
      if (ts) {
        return `<li class="open">${icon}<div><b>${esc(d.name)}</b><small>${esc(d.desc)}</small><time>${dateLine(ts)}</time></div>${badge}</li>`;
      }
      let cur = 0;
      try {
        cur = d.get(v.achCtx);
      } catch {
        cur = 0;
      }
      const safe = Number.isFinite(cur) ? Math.max(0, cur) : 0;
      const w = Math.max(0, Math.min(100, Math.round((safe / d.goal) * 100)));
      const prog = d.customProg ? d.customProg(v.achCtx) : d.unit === '%' ? `%${Math.min(safe, d.goal)}` : `${Math.min(safe, d.goal)}/${d.goal} ${d.unit}`;
      return `<li class="lock">${icon}<div><b>${esc(d.name)}</b><small>${esc(d.desc)}</small><div class="ach-sub"><div class="mt-bar"><i style="width:${w}%"></i></div><span>${esc(prog)}</span></div></div>${badge}</li>`;
    }).join('')}</ul>`;
  } else if (v.tab === 'koleksiyon') {
    body = v.coll.map((c) => {
      const p = c.total > 0 ? Math.min(100, Math.round((c.have / c.total) * 100)) : 0;
      return `<div class="prf-coll"><div><b>${esc(c.label)}</b><span>${c.have}/${c.total}</span></div><div class="mt-bar"><i style="width:${p}%"></i></div></div>`;
    }).join('');
  } else {
    body = v.hist.length === 0
      ? '<p class="prf-empty">Henüz oyun yok. İlk turunu oyna, burası dolar.</p>'
      : `<div class="dv-spark"><small>SKOR TRENDİ</small>${spark([...v.hist].reverse().map((g) => g.s))}</div>
      <ul class="prf-hist">${v.hist.map((g) => `<li><b>${fmt(g.s)}</b><span>${fmtDur(g.d)} · ${g.k} eleme · #${g.r}</span><em>${ago(g.t)}</em></li>`).join('')}</ul>`;
  }
  return `<div class="mt-card prf"><header><div><h2 id="mt-proft">PROFİLİM</h2><p class="mt-note">Yaşam boyu istatistiklerin.</p></div><button class="mt-x" data-close type="button" aria-label="Kapat">✕</button></header>
    <div class="prf-head">${v.avatar
      ? `<img src="${esc(v.avatar)}" alt="" referrerpolicy="no-referrer" />`
      : `<i class="pf-init" aria-hidden="true">${initial}</i>`
    }<div class="prf-id"><b>${esc(v.name)}</b><span class="mt-tn">${t[1]} · Sv ${v.lv.level}</span>
      <div class="mt-bar"><i style="width:${pct(v.lv)}%"></i></div><small>${xpText(v.lv)}</small></div>${ring(v.lv, 'sm')}</div>
    ${v.guest ? '<button class="au-guest-btn prf-login" data-act="auth" type="button">Giriş yap, ilerlemen kaybolmasın</button>' : ''}
    <nav class="mk-tabs prf-tabs" role="tablist" aria-label="Profil bölümleri" style="--i:${idx}">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === v.tab}" class="${k === v.tab ? 'on' : ''}" data-ptab="${k}" type="button">${l}</button>`).join('')}</nav>
    <div class="mk-body" role="tabpanel">${body}</div></div>`;
}

// ── İlerleme (1–500 yol haritası) ────────────────────────────────────
export function progHTML(totalXp: number, runs: number): string {
  const lv = levelOf(totalXp), t = tier(lv.level), allXp = totalFor(MAX_LEVEL);
  return `<div class="mt-card pg" style="--tier:${t[2]}"><header><h2 id="mt-pt">İLERLEME</h2><button class="mt-x" data-close type="button" aria-label="Kapat">✕</button></header>
  <div class="pg-top">${ring(lv, 'xl')}<div><span class="mt-tn">${t[1]}</span><h3>Seviye ${lv.level} <u>/ ${MAX_LEVEL}</u></h3>
    <div class="mt-bar"><i style="width:${pct(lv)}%"></i></div>
    <small>${lv.level >= MAX_LEVEL ? 'MAKS SEVİYE' : `Sonraki seviyeye ${fmt(lv.span - lv.into)} XP`}</small></div></div>
  <div class="pg-sum"><div><small>TOPLAM XP</small><b>${fmt(totalXp)}</b></div><div><small>OYUN</small><b>${fmt(runs)}</b></div><div><small>500'E</small><b>%${Math.min(100, (totalXp / allXp) * 100).toFixed(1)}</b></div></div>
  <ol class="pg-tiers">${TIERS.map((x, i) => {
    const end = TIERS[i + 1] ? TIERS[i + 1][0] - 1 : MAX_LEVEL, done = lv.level > end, now = lv.level >= x[0] && !done;
    return `<li class="${done ? 'done' : now ? 'now' : 'lock'}" style="--tier:${x[2]}"><i class="emb">${badge(x[0])}</i>
      <div><b>${x[1]}</b><small>Seviye ${x[0]}${x[0] === end ? '' : '–' + end}</small></div><em>${done ? 'Tamam' : now ? 'Şu an' : fmt(totalFor(x[0]) - totalXp) + ' XP'}</em></li>`;
  }).join('')}</ol></div>`;
}

// ── Oyun-içi ayarlar (Esc ile açılır; ölüm ekranında açılmaz) ──────────
export function setHTML(fx: string, q: string, fps: boolean): string {
  const radio = (group: string, val: string, label: string, cur: string): string =>
    `<button data-setopt="${group}:${val}" type="button" role="radio" aria-checked="${String(cur === val)}">${label}</button>`;
  return `<div class="mt-card st"><header><h2 id="mt-sett">AYARLAR</h2><button class="mt-x" data-setclose type="button" aria-label="Kapat">✕</button></header>
  <p class="mt-tn">Efektler</p>
  <div class="mt-setopts" role="radiogroup" aria-label="Efektler">
    ${radio('fx', 'auto', 'Otomatik', fx)}${radio('fx', 'on', 'Açık', fx)}${radio('fx', 'off', 'Kapalı', fx)}</div>
  <p class="mt-note">Otomatik: sistem ayarını izler. Kapalı: logo neonu dahil durur.</p>
  <p class="mt-tn">Kalite</p>
  <div class="mt-setopts" role="radiogroup" aria-label="Kalite">
    ${radio('q', 'low', 'Düşük', q)}${radio('q', 'med', 'Orta', q)}${radio('q', 'high', 'Yüksek', q)}</div>
  <p class="mt-note">Düşük: parçacık az, parlama ve gölge kapalı.</p>
  <button class="mt-setrow" data-setfps type="button" role="switch" aria-checked="${String(fps)}">FPS göstergesi <b>${fps ? 'Açık' : 'Kapalı'}</b></button>
  <p class="mt-note">Sayaç sağ üstte görünür. Oyun arkada devam eder.</p></div>`;
}

// ── Market ───────────────────────────────────────────────────────────
export interface Save { xp: number; coins: number; xb: number; cb: number; runs: number; own: string[]; eqFx: string; eqName: string; eqFrame: string }
export const ITEMS = [
  { id: 'xb', name: '2× XP', desc: 'Sonraki 3 oyunda tüm XP ikiye katlanır', price: 150, ic: ICON.bolt, hot: true },
  { id: 'cb', name: '2× Coin', desc: 'Sonraki 3 oyunda coin kazancı ikiye katlanır', price: 120, ic: ICON.coin, hot: false },
  { id: 'xp', name: 'XP Paketi', desc: 'Anında +500 XP kazan', price: 200, ic: ICON.rank, hot: false },
] as const;

export type Tab = 'skin' | 'fx' | 'profile' | 'boost';
export const tabOf = (key: string): Tab => { const k = key.split(':')[0]; return k === 'skin' ? 'skin' : k === 'fx' ? 'fx' : 'profile'; };
export interface ShopCtx {
  tab: Tab; note: string; thumbs: Record<string, string>; eqSkin: number; deal: string; anim: boolean; hl?: string; fresh?: string;
  hero: { name: string; color: string };
}
const SAMPLE: Lv = { level: 42, into: 60, span: 100 };
interface CardIn { key: string; rar: Rarity; art: string; title: string; sub: string; on: boolean; own: boolean; keepOn?: boolean; death?: string }

function card(c: CardIn, sv: Save, x: ShopCtx): string {
  const [kind] = c.key.split(':'), r = RARITY[c.rar], base = basePrice(c.key), price = priceFor(c.key, base, x.deal), sale = c.key === x.deal;
  const can = sv.coins >= price;
  const btn = c.on ? (c.keepOn ? `<button class="mk-btn eq" disabled type="button">${ICON.check}KULLANILIYOR</button>`
      : `<button class="mk-btn eq" data-do="off:${kind}" type="button">${ICON.check}TAKILI · Çıkar</button>`)
    : c.own ? `<button class="mk-btn use" data-do="use:${c.key}" type="button">${kind === 'skin' ? 'KULLAN' : 'TAK'}</button>`
    : `<button class="mk-btn buy ${can ? '' : 'poor'}" data-do="buy:${c.key}" type="button"><span class="pr ${can ? '' : 'poor'}">${ICON.coin}${sale ? `<s>${fmt(base)}</s>` : ''}${fmt(price)}</span></button>`;
  return `<li class="mk-card ${c.rar} ${kind} ${c.own ? 'own' : ''} ${c.on ? 'on' : ''} ${x.fresh === c.key ? 'fresh' : ''} ${x.anim ? '' : 'still'} ${x.hl === c.key ? 'hl' : ''}" style="--r:${r.color}" data-key="${c.key}" data-pv="${c.key}">
    ${sale ? `<em class="sale">-%${DEAL_PCT}</em>` : ''}<span class="rar">${r.label}</span><i class="holo"></i>
    <div class="mk-art">${c.art}</div><h4>${esc(c.title)}</h4><p>${esc(c.sub)}</p>${c.death ? `<span class="mk-death"><canvas data-deathfx="${c.death}" width="40" height="40" aria-hidden="true"></canvas>Ölüm yemi efekti dahil</span>` : ''}${btn}</li>`;
}

function body(s: Save, x: ShopCtx): string {
  const own = (k: string): boolean => s.own.includes(k);
  if (x.tab === 'skin') return `<ul class="mk-grid">${SHOP_SKINS.map((k, i) => card({
    key: 'skin:' + k.id, rar: k.rarity, title: k.name, sub: k.tag, own: own('skin:' + k.id), on: x.eqSkin === k.idx, keepOn: true,
    death: hasDeathFx(k.id) ? k.id : undefined,
    art: `<div class="ped"></div><canvas class="skc" data-swatch="${k.idx}" aria-hidden="true" style="animation-delay:${-i * 0.4}s"></canvas>${own('skin:' + k.id) ? '' : `<i class="lk">${ICON.lock}</i>`}`,
  }, s, x)).join('')}</ul>`;
  if (x.tab === 'fx') return `<p class="mk-hint">Üzerine gel: <b>boost</b> · Karta tıkla: yukarıdaki showroom'da <b>dene</b></p>
    <ul class="mk-grid fxg">${SHOP_FX.map((f) => card({
    key: 'fx:' + f.id, rar: f.rarity, title: f.name, sub: f.desc, own: own('fx:' + f.id), on: s.eqFx === f.id,
    art: `<canvas class="fxc" data-fxc="${f.id}" aria-hidden="true"></canvas>`,
  }, s, x)).join('')}</ul>`;
  if (x.tab === 'profile') return `<h3 class="mk-sec">İSİM RENGİ <small>Liderlik tablosunda adın böyle görünür</small></h3>
    <ul class="mk-grid sm">${SHOP_NAMES.map((n) => card({
    key: 'name:' + n.id, rar: n.rarity, title: n.name, sub: n.tag, own: own('name:' + n.id), on: s.eqName === n.id,
    art: `<div class="nm"><span class="${ANIM[n.id] ? 'nc ' + ANIM[n.id] : 'nc'}" style="--nc:${n.color}" data-t="Oyuncu">Oyuncu</span><small>${n.name}</small></div>`,
  }, s, x)).join('')}</ul>
    <h3 class="mk-sec">ROZET ÇERÇEVESİ <small>Seviye rozetini süsler</small></h3>
    <ul class="mk-grid sm">${SHOP_FRAMES.map((f) => card({
    key: 'frame:' + f.id, rar: f.rarity, title: f.name, sub: f.tag, own: own('frame:' + f.id), on: s.eqFrame === f.id,
    art: `<div class="fr">${ring(SAMPLE, 'lg', f.id)}</div>`,
  }, s, x)).join('')}</ul>`;
  return `<ul class="mk-list">${ITEMS.map((it) => {
    const have = it.id === 'xb' ? s.xb : it.id === 'cb' ? s.cb : -1, can = s.coins >= it.price;
    const pips = [0, 1, 2].map((i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('');
    return `<li class="${it.hot ? 'hot' : ''}">${it.hot ? '<em class="tag">POPÜLER</em>' : ''}<i class="mt-ico">${it.ic}</i>
      <div><b>${it.name}</b><small>${it.desc}</small>${have >= 0 ? `<div class="own"><span class="pips">${pips}</span><small>${have ? have + ' oyun kaldı' : 'Aktif değil'}</small></div>` : ''}</div>
      <button class="mk-btn buy ${can ? '' : 'poor'}" data-do="buy:boost:${it.id}" type="button"><span class="pr ${can ? '' : 'poor'}">${ICON.coin}${fmt(it.price)}</span></button></li>`;
  }).join('')}</ul>`;
}

export function shopHTML(s: Save, x: ShopCtx): string {
  const tabs: Array<[Tab, string]> = [['skin', 'Görünüm'], ['fx', 'Efekt'], ['profile', 'Profil'], ['boost', 'Boost']];
  const dk = x.deal, owned = s.own.includes(dk), eq = fxById(s.eqFx);
  const deal = owned ? '' : `<div class="mk-deal"><span class="dl-ic">${ICON.bolt}</span><div><small>GÜNÜN FIRSATI · <span data-cd>--:--:--</span></small>
    <b>${esc(nameOf(dk))}</b><span class="dl-pr"><s>${ICON.coin}${fmt(basePrice(dk))}</s><strong>${ICON.coin}${fmt(priceFor(dk, basePrice(dk), dk))}</strong><em>-%${DEAL_PCT}</em></span></div>
    <button class="dl-go" data-do="deal" type="button">İNCELE</button></div>`;
  return `<div class="mt-card mk"><canvas class="mk-amb" aria-hidden="true"></canvas><canvas class="mk-conf" aria-hidden="true"></canvas>
  <header><div><h2 id="mt-st">MARKET</h2><p class="mt-note" role="status">${esc(x.note) || 'Coin harca, tarzını göster.'}</p></div>
    <span class="mt-coin big" data-coins="${s.coins}">${ICON.coin}<b>${fmt(s.coins)}</b></span><button class="mt-x" data-close type="button" aria-label="Kapat">✕</button></header>
  <div class="mk-top"><div class="mk-show" style="--c:${eq?.color ?? '#2be7ff'}"><canvas data-stage="show" aria-hidden="true"></canvas>
      <div class="mk-cap"><small data-capl>ŞU AN KULLANILAN</small><b data-capn>${esc(x.hero.name)}</b><span data-caps>${eq ? '+ ' + esc(eq.name) + ' efekti' : 'Efekt takılı değil'}</span></div></div>${deal}</div>
  <nav class="mk-tabs" role="tablist" style="--i:${tabs.findIndex((t) => t[0] === x.tab)}">${tabs.map(([t, l]) => `<button role="tab" aria-selected="${t === x.tab}" class="${t === x.tab ? 'on' : ''}" data-do="tab:${t}" type="button">${l}</button>`).join('')}</nav>
  <div class="mk-body" role="tabpanel">${body(s, x)}</div></div>`;
}

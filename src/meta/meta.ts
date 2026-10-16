// Meta katmanı mantığı: HUD, ölüm ekranı, ilerleme, market. Görünüm: views.ts.
// Motora yalnızca `Game.onDeath` kancasıyla bağlanır; geri kalan her şey okuma.
import './meta.css';
import type { Game } from '../core/Game.ts';
import type { Snake } from '../entities/Snake.ts';
import { commitRun, saveSkin } from '../menu/storage.ts';
import { setFpsMeter } from '../utils/fps.ts';
import { fpsOn, fxCalm, fxMode, qMode, setFpsOn, setFxMode, setQuality } from '../utils/settings.ts';
import type { FxMode, Quality } from '../utils/settings.ts';
import { setSnakeFx } from '../systems/SkinFx.ts';
import { SKIN_DEFS } from '../utils/Constants.ts';
import { SHOP_FRAMES, SHOP_FX, SHOP_NAMES, SHOP_SKINS, basePrice, dealKey, fxById, lookById, nameOf, priceFor, rarityOf, skinByIdx } from './catalog.ts';
import { burst } from './fxstage.ts';
import { SPECIAL_SHARE, SPECIAL_W, chestPool, chestStatus, claimChest, countdown, dayStr, epikPool, loadChest, nadirPool } from './chest.ts';
import { startChestFx } from './chestfx.ts';
import type { ChestCtl, ChestRarity } from './chestfx.ts';
import { bindShop } from './shopfx.ts';
import {
  ANIM, ITEMS, authHTML, chestHTML, deathHTML, hudShell, lbHTML, levelOf, lvHTML, migrateHTML, pct, pfHTML, profileHTML, progHTML, scoreHTML, setHTML, setLook, shopHTML, tabOf, tier, xpText,
  type AuthPill, type CollRow, type MigrateView, type ProfTab, type Row, type Save, type SideSum, type Tab,
} from './views.ts';
import { getUser, isAuthAvailable, onAuthChange, signInWithGoogle, signOut } from '../auth/auth.ts';
import { loadCareer, mergeCareer, parseCareer, recordCareerGame, saveCareer } from './career.ts';
import type { Career } from './career.ts';
import { ACHIEVEMENTS, evalAchievements } from './achieve.ts';
import type { AchCtx } from './achieve.ts';
import type { AuthUser } from '../auth/auth.ts';
import {
  backupLocal, clearCloudLocal, cloudBind, cloudHasPending, cloudLoad, cloudMarkSynced, cloudPushNow, cloudPushStrict, cloudSaveNow,
  cloudSetReady, cloudTouch, cloudUnbind, clearSyncMarker, isBlank, isSameInstant, loadSyncMarker, onCloudConflict, onCloudStatus, sameProgress, snapshotSig,
  summarizeLocal, summarizeRow, writeLocal,
  type CloudRow, type CloudStatus, type ProgSum,
} from '../auth/cloudSave.ts';
import krampus from '../assets/skins/krampus/head.webp';
import cygnus from '../assets/skins/cygnus/head.webp';
import werewolf from '../assets/skins/werewolf/head.webp';
import xen from '../assets/skins/Purple XEN/head.webp';
import redwolf from '../assets/skins/Red Wolf/head.webp';
import pinkdragon from '../assets/skins/Pink Dragon/head.webp';
import greendragon from '../assets/skins/Green Dragon/head.webp';
import bluedragon from '../assets/skins/Blue Dragon/head.webp';

const THUMBS: Record<string, string> = { krampus, cygnus, werewolf, xen, redwolf, pinkdragon, greendragon, bluedragon };

const KEY = 'snakez.meta', BEST = 'snakez.meta.best';
const blank = (): Save => ({ xp: 0, coins: 0, xb: 0, cb: 0, runs: 0, own: [], eqFx: '', eqName: '', eqFrame: '' });
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
function load(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Save>;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return blank();
    return {
      xp: num(raw.xp), coins: num(raw.coins), xb: num(raw.xb), cb: num(raw.cb), runs: num(raw.runs),
      own: Array.isArray(raw.own) ? raw.own.filter((x): x is string => typeof x === 'string') : [],
      eqFx: str(raw.eqFx), eqName: str(raw.eqName), eqFrame: str(raw.eqFrame),
    };
  } catch { return blank(); }
}
function readBest(): number {
  try { return num(Number(localStorage.getItem(BEST) || 0)); } catch { return 0; }
}
const store = (s: Save) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* gizli mod */ } };
const reduce = (): boolean => fxCalm();
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

/** Bulut göstergesi metni. Sade: dot + iki kelimeyi geçmez. */
function syncPill(s: CloudStatus): { text: string; st: string } {
  if (s === 'saving') return { text: 'Kaydediliyor…', st: 'saving' };
  if (s === 'offline') return { text: 'Çevrimdışı', st: 'offline' };
  if (s === 'error') return { text: 'Kayıt hatası', st: 'error' };
  if (s === 'conflict') return { text: 'Eşleşmiyor', st: 'conflict' };
  return { text: 'Kaydedildi', st: 'ok' };
}

export class Meta {
  private save = load();
  private root = document.createElement('div');
  private cur: Snake | null = null;
  private t0 = 0; private peak = 0; private kills = 0; private bestRank = 99;
  private series: number[] = []; private lastSample = 0; private lvKey = ''; private pfKey = '';
  private live = 0; private liveShown = 0; private acc = 0; private settled = false; private lvShown = 0;
  private lbSig = ''; private lastLb = 0;
  private game: Game;
  private tab: Tab = 'skin';
  private disposeShop: (() => void) | null = null;
  private shownCoins = -1;
  private fresh = '';
  private lastScore = 0;
  private lastName = 'Oyuncu';
  private lastSkin = 0;
  /** Ayar paneli kapanınca odağı geri verilecek öğe. */
  private setReturn: HTMLElement | null = null;
  /** Sandık orkestratörü dispose'u + bekleme sayacı + çift-tık kilidi. */
  private chestFx: ChestCtl | null = null;
  private chestTimer = 0;
  private chestBusy = false;
  /** Giriş: bulut kullanıcısı (null = misafir), modal durumu, odak dönüşü. */
  private authUser: AuthUser | null = null;
  private authBusy = false;
  private authReturn: HTMLElement | null = null;
  private authNudgeOff = false;
  private toastTimer = 0;
  /** Bulut: üst bar göstergesi, bekleyen aktarma kararı, değişiklik yoklaması. */
  private cloudUi: CloudStatus = 'ok';
  private pendingMigrate: { mode: 'upload' | 'choose' | 'conflict' | 'signout-warn'; local: ProgSum; remote: ProgSum | null; row: CloudRow | null } | null = null;
  private lastCloudSig = '';
  private lastSigCheck = 0;
  private refreshing = false;
  /** Oturum başına yükleme/karşılaştırma bir kez çalışır (ikinci çağrı no-op). */
  private bootDoneUid = '';
  /** Profilim: açık sekme + kapanınca odağı geri verilecek öğe. */
  private profTab: ProfTab = 'genel';
  private profReturn: HTMLElement | null = null;

  constructor(game: Game) {
    this.game = game;
    this.root.id = 'meta';
    this.root.innerHTML = `<div class="mt-pf" hidden></div><div class="mt-hud" hidden>${hudShell()}</div><div class="mt-over" hidden role="dialog" aria-modal="true" aria-labelledby="mt-ot"></div>
      <div class="mt-modal" data-prog hidden role="dialog" aria-modal="true" aria-labelledby="mt-pt"></div>
      <div class="mt-modal" data-shop hidden role="dialog" aria-modal="true" aria-labelledby="mt-st"></div>
      <div class="mt-modal" data-set hidden role="dialog" aria-modal="true" aria-labelledby="mt-sett"></div>
      <div class="mt-modal" data-chest hidden role="dialog" aria-modal="true" aria-labelledby="mt-cht"></div>
      <div class="mt-modal" data-auth hidden role="dialog" aria-modal="true" aria-labelledby="mt-autht"></div>
      <div class="mt-modal" data-profile hidden role="dialog" aria-modal="true" aria-labelledby="mt-proft"></div>
      <div class="au-toast" hidden aria-hidden="true"></div>`;
    document.body.appendChild(this.root);
    game.onDeath = (s, k) => this.death(s, k);
    this.applyLook();
    const play = game.play.bind(game);
    game.play = (name: string, skin: number) => {
      this.lastName = name; this.lastSkin = skin;
      play(name, this.guard(skin));
    };
    window.setInterval(() => this.tick(), 120);
    window.addEventListener('keydown', (e) => this.key(e), true);
    this.$('.mt-pf').addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      // Hesap menüsü: avatar hapı açar/kapar, içi ayrı yönetilir.
      const um = t.closest<HTMLElement>('[data-authmenu]');
      if (um && this.$('.mt-pf').contains(um)) {
        const menu = this.$('.mt-pf').querySelector<HTMLElement>('[data-aumenu]');
        if (menu) {
          const open = menu.hidden;
          menu.hidden = !open;
          um.setAttribute('aria-expanded', String(open));
        }
        return;
      }
      const b = t.closest<HTMLElement>('[data-act]');
      if (b) this.act(b.dataset.act!);
    });
    // Hesap menüsü dışına tıklayınca kapanır.
    document.addEventListener('pointerdown', (e) => {
      const pf = this.$('.mt-pf');
      const menu = pf.querySelector<HTMLElement>('[data-aumenu]');
      const t = e.target as HTMLElement | null;
      if (menu && !menu.hidden && t && !pf.contains(t)) {
        menu.hidden = true;
        pf.querySelector('[data-authmenu]')?.setAttribute('aria-expanded', 'false');
      }
    });
    window.addEventListener('snakez:shop', () => this.shop());
    window.addEventListener('snakez:profile', () => this.profile());
    // Giriş modali: kart dışına tıklayınca kapanır (kartın kendisi durdurmaz).
    this.$('[data-auth]').addEventListener('pointerdown', (e) => {
      if (e.target === e.currentTarget) this.closeAuth();
    });
    // Profilim aynı kalıpla kapanır (odak geri verilir).
    this.$('[data-profile]').addEventListener('pointerdown', (e) => {
      if (e.target === e.currentTarget) this.hideProfile();
    });
    this.initAuth();
    // Bulut: statü göstergesi + çakışma diyaloğu + çevrimdışı/çevrimiçi.
    onCloudStatus((s) => {
      this.cloudUi = s;
      this.pfKey = '';
    });
    onCloudConflict((row) => {
      // Kaydetme durdu (ready=false); kullanıcı karar verene kadar bekler.
      // Aynı karar zaten açıksa yeniden açılmaz.
      if (this.pendingMigrate?.mode === 'conflict') return;
      this.pendingMigrate = { mode: 'conflict', local: summarizeLocal(), remote: summarizeRow(row), row };
      this.openMigrate();
    });
    window.addEventListener('online', () => cloudTouch());
    // Sekme kapanırken/gizlenirken son bir kez gönder (best-effort).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void cloudSaveNow(5000);
    });
    window.addEventListener('pagehide', () => {
      void cloudSaveNow(3000);
    });
    // Sekme gizlenirse sürmekte olan açılışı atla; geri görünür olunca
    // bekleme sandığını tazele (gece yarısı geçmiş olabilir).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.chestFx?.skip();
        return;
      }
      const m = this.$('[data-chest]');
      if (!m.hidden && !m.querySelector('[data-chest-open]') && !m.querySelector('.ch-prize')) this.chest();
    });
  }

  private $<T extends HTMLElement>(sel: string): T { return this.root.querySelector(sel) as T; }
  private open() { return !this.$('.mt-over').hidden; }

  // ── HUD ──────────────────────────────────────────────────────────────
  private tick(): void {
    const g = this.game, me = g.me;
    this.$('.mt-hud').hidden = !me;
    this.$('.mt-pf').hidden = !!me;
    // Menüdeyken (isim/skin değişir) 5 sn'de bir yerel imzaya bakılır;
    // fark varsa bulut kuyruğuna girer. Misafirken cloudTouch sessizdir.
    if (!me) {
      this.paintPf();
      this.decorateMenu();
      if (this.authUser) {
        const now = performance.now();
        if (now - this.lastSigCheck > 5000) {
          this.lastSigCheck = now;
          const s = snapshotSig();
          if (s !== this.lastCloudSig) {
            this.lastCloudSig = s;
            cloudTouch();
          }
        }
      }
      return;
    }
    const now = performance.now();
    if (me !== this.cur) {
      this.cur = me; this.t0 = now; this.peak = 10; this.kills = 0; this.bestRank = 99; this.series = [10]; this.lastSample = now;
      this.live = 0; this.liveShown = 0; this.acc = 0; this.settled = false;
      this.applyFx(me);
    }
    this.peak = Math.max(this.peak, me.mass);
    if (me.kills > this.kills) { this.pop(`+${(me.kills - this.kills) * 50} XP · Eleme`); this.kills = me.kills; }
    if (now - this.lastSample > 1000 && me.alive) {
      this.series.push(me.mass);
      // Sınırsız büyüme: 10 dk = 600 nokta SVG polyline'ı ağırlaştırırdı.
      if (this.series.length > 600) this.series.splice(0, this.series.length - 600);
      this.lastSample = now;
    }

    const all = g.snakes.filter((s) => s.alive).sort((a, b) => b.mass - a.mass);
    const rank = Math.max(1, all.indexOf(me) + 1);
    if (me.alive) this.bestRank = Math.min(this.bestRank, rank);
    const toRow = (s: Snake, i: number): Row => ({ name: s.name, mass: s.mass, me: s === me, rank: i + 1 });
    const mine = me.alive && rank > 10 ? toRow(me, rank - 1) : null;
    // Liderlik 8Hz'de yeniden kuruluyordu: lb-drift animasyonu hiç akamıyor,
    // her tick'te 10 satırlık DOM çöpü üretiliyordu. 1Hz + imza farkı:
    // yapı aynıysa DOM'a dokunulmaz (menu.ts'teki desenin aynısı).
    const top = all.slice(0, 10).map(toRow);
    const sig = top.map((r) => `${r.rank}|${r.name}|${Math.round(r.mass)}|${r.me ? 1 : 0}`).join('~') + (mine ? `|${mine.rank}:${Math.round(mine.mass)}` : '');
    if (sig !== this.lbSig && now - this.lastLb > 900) {
      this.lbSig = sig; this.lastLb = now;
      this.$('[data-lb]').innerHTML = lbHTML(top, mine);
    }
    this.$('[data-cnt]').textContent = `${all.length} yılan`;
    const ahead = rank > 1 ? all[rank - 2].mass - me.mass : 0;
    this.$('[data-lbf]').textContent = rank === 1 ? 'Arenanın lideri sensin' : `#${rank - 1}'e ${fmt(ahead)} kaldı`;
    this.$('[data-sc]').innerHTML = scoreHTML(me.mass, me.kills, (now - this.t0) / 1000, rank, all.length);
    const mul = this.save.xb > 0 ? 2 : 1;
    if (me.alive && !this.settled) this.live = Math.round((this.peak * 0.6 + me.kills * 50 + ((now - this.t0) / 1000) * 1.5) * mul);
    this.paintLv(this.settled ? 0 : this.live);
  }

  // ── Canlı XP: çubuk oyun sırasında dolar, DOM yerinde güncellenir (animasyon bozulmaz) ──
  private paintLv(live: number): void {
    const el = this.$('[data-lv]'), lv = levelOf(this.save.xp + live), key = `${lv.level}|${this.save.coins}`;
    if (key !== this.lvKey) {
      const up = this.lvShown > 0 && lv.level > this.lvShown;
      this.lvKey = key; this.lvShown = lv.level;
      el.style.setProperty('--tier', tier(lv.level)[2]);
      el.innerHTML = lvHTML(lv, this.save.coins, live);
      if (up) { this.pop(`SEVİYE ATLADIN · ${lv.level}`, 'up'); this.flash(el, 'lvup', 1100); }
    } else {
      el.querySelector<HTMLElement>('[data-bar]')!.style.width = `${pct(lv)}%`;
      el.querySelector<HTMLElement>('[data-ring]')!.style.setProperty('--p', pct(lv).toFixed(1));
      el.querySelector('[data-xpt]')!.textContent = xpText(lv);
      el.querySelector('[data-run]')!.textContent = `+${fmt(live)} XP`;
    }
    if (live > this.liveShown) {
      this.acc += live - this.liveShown;
      if (this.acc >= 10) {
        const g = document.createElement('div');
        g.className = 'mt-gain'; g.textContent = `+${fmt(this.acc)} XP`;
        el.appendChild(g); window.setTimeout(() => g.remove(), 1200);
        this.flash(el, 'gain', 500); this.acc = 0;
      }
    }
    this.liveShown = live;
  }

  private flash(el: HTMLElement, cls: string, ms: number): void {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
  }

  private paintPf(): void {
    const lv = levelOf(this.save.xp);
    const au: AuthPill = this.authUser
      ? { mode: 'user', name: this.authUser.name, avatar: this.authUser.avatar, email: this.authUser.email }
      : { mode: 'guest' };
    const sync = this.authUser ? syncPill(this.cloudUi) : null;
    const key = `${this.save.xp}|${this.save.coins}|${dayStr()}|${au.mode}|${this.authUser?.id ?? ''}|${this.cloudUi}`;
    if (key === this.pfKey) return;
    this.pfKey = key;
    const pf = this.$('.mt-pf');
    pf.style.setProperty('--tier', tier(lv.level)[2]);
    // Sandık hazır durumu güne bağlı: anahtar güne katılır, gece yarısı
    // geçince buton kendiliğinden parlar (ekstra zamanlayıcı yok).
    const st = chestStatus();
    const blocked = this.chestBlocked();
    const ready = st.ready && !blocked;
    pf.innerHTML = pfHTML(lv, this.save.coins, ready,
      ready ? 'Günlük sandık hazır!' : blocked ? 'Yarın tekrar gel' : `Sonraki sandık: ${countdown(st.msLeft)}`, au, sync);
  }

  private pop(text: string, cls = ''): void {
    const el = document.createElement('div');
    el.textContent = text; el.className = cls;
    this.$('[data-pops]').appendChild(el);
    window.setTimeout(() => el.remove(), 1600);
  }

  // ── Ölüm: ödül hesabı + ekran ────────────────────────────────────────
  private death(s: Snake, killer: Snake | null): void {
    const secs = Math.max(1, (performance.now() - this.t0) / 1000), sv = this.save;
    const score = Math.floor(Math.max(this.peak, s.mass)), xMul = sv.xb > 0, cMul = sv.cb > 0;
    const raw: Array<[string, number]> = [['Skor', score * 0.6], ['Eleme', s.kills * 50], ['Hayatta kalma', secs * 1.5]];
    const parts = raw.map(([l, v]) => [l, Math.round(v * (xMul ? 2 : 1))] as [string, number]);
    const xp = parts.reduce((a, [, v]) => a + v, 0);
    const coins = Math.round((score / 12 + s.kills * 8 + secs / 10) * (cMul ? 2 : 1));
    this.lastScore = score; this.settled = true;
    const best = readBest(), isBest = score > best;
    if (isBest) try { localStorage.setItem(BEST, String(score)); } catch { /* */ }
    const before = levelOf(sv.xp);
    sv.xp += xp; sv.coins += coins; sv.runs++; sv.xb = Math.max(0, sv.xb - 1); sv.cb = Math.max(0, sv.cb - 1);
    store(sv);
    // Yaşam boyu sayaçlar: motor değil, zaten çalışan ölüm akışı yazar.
    const career = recordCareerGame({ score, kills: s.kills, secs, bestRank: Math.min(this.bestRank, 99), coins });
    // Yeni başarımlar: tekse adıyla, çoksa tek özet toast.
    this.announceAch(evalAchievements(this.achCtx(career)));
    // Ölüm ekranı gösterilirken bekleyen kayıt hemen gönderilir (menüye
    // geçiş reload eder; debounce'a bırakılırsa kayıt yarıda kalır).
    this.flushCloud();
    const after = levelOf(sv.xp), t0 = tier(before.level)[1], t1 = tier(after.level)[1];
    const o = this.$('.mt-over');
    o.innerHTML = deathHTML({
      killer: killer?.name ?? null, score, best, isBest, kills: s.kills, secs, bestRank: Math.min(this.bestRank, 99),
      parts, xp, coins, xMul, cMul, before, after, tierUp: t1 !== t0 ? t1 : null, series: [...this.series, score],
      authNudge: !this.authUser && !this.authNudgeOff,
    });
    o.hidden = false;
    o.querySelectorAll<HTMLElement>('[data-n]').forEach((el) => this.count(el));
    // Hatırlatma satırı kapatılırsa aynı oturumda tekrar gösterilmez.
    o.querySelector('[data-auth-x]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      o.querySelector('[data-auth-nudge]')?.remove();
      this.authNudgeOff = true;
    });
    const bar = o.querySelector<HTMLElement>('[data-bar]');
    if (bar) {
      const final = bar.dataset.bar!, lvUp = after.level > before.level;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bar.style.width = lvUp ? '100%' : `${final}%`;
        if (lvUp) window.setTimeout(() => {
          bar.style.transition = 'none'; bar.style.width = '0';
          requestAnimationFrame(() => { bar.style.transition = ''; bar.style.width = `${final}%`; });
        }, reduce() ? 0 : 750);
      }));
    }
    o.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => b.addEventListener('click', () => this.act(b.dataset.act!)));
    o.querySelector<HTMLElement>('.mt-cta')!.focus();
    this.lvKey = ''; this.pfKey = '';
  }

  /** Bekleyen bulut kaydını hemen gönder (ateşle-unut). Temiz durumdaysa
   *  ağa hiç çıkmaz; ölüm/menü/market gibi geçişlerde çağrılır. */
  private flushCloud(): void {
    void cloudSaveNow(6000);
  }

  private count(el: HTMLElement): void {
    const to = Number(el.dataset.n), plus = el.classList.contains('xp') || el.classList.contains('co') ? '+' : '';
    const d = reduce() ? 1 : 1100, t0 = performance.now() + (reduce() ? 0 : 250);
    const step = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - t0) / d));
      el.textContent = plus + fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private act(a: string): void {
    if (a === 'retry') { this.flushCloud(); this.closeModals(); this.$('.mt-over').hidden = true; this.game.play(this.lastName, this.guard(this.lastSkin)); }
    else if (a === 'menu') { this.flushCloud(); commitRun(this.lastScore); location.reload(); }
    else if (a === 'shop') { this.flushCloud(); this.shop(); }
    else if (a === 'prog') { this.flushCloud(); this.prog(); }
    else if (a === 'chest') this.chest();
    else if (a === 'auth') this.openAuth();
    else if (a === 'profile') { this.flushCloud(); this.profile(); }
    else if (a === 'sync') {
      if (this.pendingMigrate) this.openMigrate();
      else void cloudSaveNow(8000); // hata/çevrimdışıysa yeniden dener
    }
    else if (a === 'signout') {
      const pf = this.$('.mt-pf');
      pf.querySelector<HTMLElement>('[data-aumenu]')!.hidden = true;
      pf.querySelector('[data-authmenu]')?.setAttribute('aria-expanded', 'false');
      if (!this.authUser) return;
      void this.signOutFlow();
    }
  }

  private closeModals(): void {
    this.$('[data-prog]').hidden = true; this.$('[data-shop]').hidden = true; this.$('[data-set]').hidden = true;
    this.$('[data-chest]').hidden = true;
    this.$('[data-chest]').innerHTML = '';
    this.$('[data-profile]').hidden = true;
    this.$('[data-profile]').innerHTML = '';
    this.closeAuth();
    this.stopChestFx();
    this.disposeShop?.(); this.disposeShop = null; this.shownCoins = -1;
    if (this.open()) this.$<HTMLElement>('.mt-cta')?.focus();
  }

  /** Sandık orkestratörü + bekleme sayacı iptali (sızıntı yok). */
  private stopChestFx(): void {
    this.chestFx?.dispose();
    this.chestFx = null;
    if (this.chestTimer) window.clearTimeout(this.chestTimer);
    this.chestTimer = 0;
  }

  private key(e: KeyboardEvent): void {
    const over = this.open(), setOpen = !this.$('[data-set]').hidden;
    const chestOpen = !this.$('[data-chest]').hidden;
    const authOpen = !this.$('[data-auth]').hidden;
    const profileOpen = !this.$('[data-profile]').hidden;
    const modal = !this.$('[data-prog]').hidden || !this.$('[data-shop]').hidden || chestOpen || authOpen || profileOpen;
    // Esc: ayar açıksa kapat; market/ilerleme/giriş açıksa kapat; ölüm ekranı
    // açıksa HİÇBİR ŞEY yapma (ölüm akışı bozulmaz); oyundaysa ayar aç.
    if (e.key === 'Escape') {
      if (setOpen) this.closeSet();
      else if (authOpen) this.closeAuth();
      else if (modal) this.closeModals();
      else if (!over && this.game.me?.alive) this.openSet();
      else return;
      e.preventDefault(); e.stopPropagation();
      return;
    }
    // Odak açık modalde kalır (trap): Tab kart içinde döner.
    const trapSel = authOpen ? '[data-auth]' : profileOpen ? '[data-profile]' : null;
    if (trapSel && e.key === 'Tab') {
      const m = this.$(trapSel);
      const items = [...m.querySelectorAll<HTMLElement>('button:not([disabled])')];
      if (items.length) {
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
      return;
    }
    if (!over && !modal && !setOpen) return;
    const tag = (e.target as HTMLElement).tagName, act = e.key === 'Enter' || e.key === ' ';
    // Sandık açılışı sürerken Enter/Space (buton dışı) animasyonu atlar.
    if (act && chestOpen && tag !== 'BUTTON' && this.chestFx) {
      this.chestFx.skip();
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (act && over && !modal && !setOpen && tag !== 'BUTTON') this.act('retry');
    else if (act && tag === 'BUTTON') (e.target as HTMLElement).click();
    else return;
    e.preventDefault(); e.stopPropagation();
  }

  private mount(sel: string, html: string): HTMLElement {
    const m = this.$(sel);
    m.innerHTML = html; m.hidden = false;
    m.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModals()));
    return m;
  }

  private prog(): void {
    this.mount('[data-prog]', progHTML(this.save.xp, this.save.runs)).querySelector<HTMLElement>('[data-close]')!.focus();
  }

  /** Yerel tekil okumalar (yoksa/bozuksa varsayılan; yazma yok). */
  private lsInt(key: string): number {
    try {
      const n = Number(localStorage.getItem(key));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  private lsName(): string {
    try {
      const v = localStorage.getItem('snakez.name');
      return v ? v : 'Oyuncu';
    } catch {
      return 'Oyuncu';
    }
  }

  // ── Profilim: yaşam boyu istatistikler (3 iç sekme) ────────────────────
  // Veri: save (coin/XP/kuşam) + career (yaşam boyu) + katalog sayıları.
  // Başkasının profili yok; misafir de kendi yerelini görür.
  /** Başarım değerlendirme bağlamı (koleksiyon sayılarıyla birlikte). */
  private achCtx(career: Career): AchCtx {
    const own = this.save.own;
    const skinsHave = SKIN_DEFS.length - SHOP_SKINS.length + SHOP_SKINS.filter((s) => own.includes('skin:' + s.id)).length;
    return { career, level: levelOf(this.save.xp).level, games: this.lsInt('snakez.games'), skinsHave, skinsTotal: SKIN_DEFS.length };
  }

  /** Yeni başarım duyurusu: tekse adıyla, çoksa tek özet (spam yok). */
  private announceAch(ids: string[]): void {
    if (ids.length === 1) {
      const d = ACHIEVEMENTS.find((a) => a.id === ids[0]);
      this.toast(`Başarım açıldı: ${d ? d.name : ids[0]}`);
    } else if (ids.length > 1) {
      this.toast(`${ids.length} başarım açıldı`);
    }
  }

  private profile(tab: ProfTab = this.profTab): void {
    this.profTab = tab;
    const lv = levelOf(this.save.xp);
    const career = loadCareer();
    const ctx = this.achCtx(career);
    // Profil açılırken değerlendir (eski veriler toplu açılır, tek toast).
    this.announceAch(evalAchievements(ctx));
    const own = this.save.own;
    const has = (k: string): boolean => own.includes(k);
    // Boost sayılmaz katalog koleksiyonu değil: anlık xp paketi dışındaki
    // tüketilebilirler (xb/cb) arasından aktif olanlar sayılır.
    const boostKinds = ITEMS.filter((i) => i.id !== 'xp');
    const boostHave = boostKinds.filter((i) => (i.id === 'xb' ? this.save.xb : this.save.cb) > 0).length;
    const coll: CollRow[] = [
      { label: 'Görünüm', have: ctx.skinsHave, total: ctx.skinsTotal },
      { label: 'Efekt', have: SHOP_FX.filter((f) => has('fx:' + f.id)).length, total: SHOP_FX.length },
      { label: 'Rozet çerçevesi', have: SHOP_FRAMES.filter((f) => has('frame:' + f.id)).length, total: SHOP_FRAMES.length },
      { label: 'İsim rengi', have: SHOP_NAMES.filter((n) => has('name:' + n.id)).length, total: SHOP_NAMES.length },
      { label: 'Boost (aktif)', have: boostHave, total: boostKinds.length },
    ];
    // Üyelik: girişliyse hesap tarihi, misafirse ilk görülme.
    let memberTs = career.firstSeen;
    if (this.authUser?.createdAt) {
      const t = Date.parse(this.authUser.createdAt);
      if (Number.isFinite(t) && t > 0) memberTs = t;
    }
    // Açık hesap menüsü varsa kapat (odak profile geçer).
    const pf = this.$('.mt-pf');
    const am = pf.querySelector<HTMLElement>('[data-aumenu]');
    if (am && !am.hidden) {
      am.hidden = true;
      pf.querySelector('[data-authmenu]')?.setAttribute('aria-expanded', 'false');
    }
    if (this.$('[data-profile]').hidden) this.profReturn = document.activeElement as HTMLElement | null;
    const m = this.mount('[data-profile]', profileHTML({
      tab, name: this.authUser?.name ?? this.lsName(),
      avatar: this.authUser?.avatar ?? '', guest: !this.authUser,
      lv, best: career.bestScore, games: this.lsInt('snakez.games'),
      kills: career.kills, playSecs: career.playSecs, longest: career.longest,
      bestRank: career.bestRank, coins: career.coins,
      totalScore: career.totalScore, bestKills: career.bestKills,
      memberTs, streak: career.streak, bestStreak: career.bestStreak,
      coll, hist: career.games, ach: career.ach, achCtx: ctx,
    }));
    m.querySelectorAll<HTMLElement>('[data-ptab]').forEach((b) => b.addEventListener('click', () => {
      const next = b.dataset.ptab as ProfTab;
      this.profile(next);
      this.$('[data-profile]').querySelector<HTMLElement>(`[data-ptab="${next}"]`)?.focus({ preventScroll: true });
    }));
    m.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => b.addEventListener('click', () => this.profAct(b.dataset.act!)));
    m.querySelector<HTMLElement>('[data-close]')!.focus({ preventScroll: true });
  }

  /** Profil içinden açılanlar kartın üstüne binmesin diye önce gizlenir. */
  private profAct(a: string): void {
    if (a === 'prog') {
      this.profReturn = null;
      this.hideProfile();
      this.prog();
      return;
    }
    if (a === 'auth') {
      this.profReturn = null;
      this.hideProfile();
      this.openAuth();
    }
  }

  private hideProfile(): void {
    const m = this.$('[data-profile]');
    m.hidden = true;
    m.innerHTML = '';
    if (this.profReturn?.isConnected) this.profReturn.focus({ preventScroll: true });
    this.profReturn = null;
  }

  // ── Oyun-içi ayarlar (Esc) ──────────────────────────────────────────
  // Menüdeki panelin oyun-içi karşılığı: aynı anahtarlara yazar
  // (utils/settings.ts), motoru duraklatmaz — oyun arkada devam eder.
  // Ölüm ekranı açıkken açılmaz (key() korur).
  private openSet(): void {
    this.setReturn = document.activeElement as HTMLElement | null;
    this.$('[data-set]').hidden = false;
    this.paintSet();
  }
  private paintSet(focusVal?: string): void {
    const m = this.$('[data-set]');
    m.innerHTML = setHTML(fxMode(), qMode(), fpsOn());
    m.querySelectorAll<HTMLElement>('[data-setopt]').forEach((b) => b.addEventListener('click', () => {
      const v = (b.dataset.setopt ?? '').split(':');
      if (v[0] === 'fx') setFxMode(v[1] as FxMode);
      else if (v[0] === 'q') setQuality(v[1] as Quality);
      this.paintSet(b.dataset.setopt);
    }));
    m.querySelector('[data-setfps]')?.addEventListener('click', () => {
      setFpsOn(!fpsOn());
      setFpsMeter(fpsOn());
      this.paintSet('fps');
    });
    m.querySelector('[data-setclose]')?.addEventListener('click', () => this.closeSet());
    const t = focusVal === 'fps'
      ? m.querySelector<HTMLElement>('[data-setfps]')
      : focusVal
        ? m.querySelector<HTMLElement>(`[data-setopt="${focusVal}"]`)
        : m.querySelector<HTMLElement>('[data-setopt][aria-checked="true"]');
    (t ?? m.querySelector<HTMLElement>('[data-setclose]')!).focus();
  }
  private closeSet(): void {
    const m = this.$('[data-set]');
    m.hidden = true;
    m.innerHTML = '';
    if (this.setReturn?.isConnected) this.setReturn.focus({ preventScroll: true });
    this.setReturn = null;
  }

  // ── Giriş (Supabase Google OAuth) ────────────────────────────────────
  // Yalnızca kimlik: veri OKUMA/YAZMA yok, localStorage'a dokunulmaz.
  // Yapılandırılmamışsa (anahtar yok) her şey misafir kipinde aynen çalışır.
  private initAuth(): void {
    if (!isAuthAvailable()) return;
    onAuthChange((ev, user) => {
      if (ev === 'SIGNED_IN' && user) {
        this.authUser = user;
        this.pfKey = '';
        this.toast(`Hoş geldin, ${user.name}`);
        void this.refreshFromCloud();
      } else if (ev === 'SIGNED_OUT') {
        // Kendi çıkış akışımız yeniden yükler; yabancı oturum düşüşünde
        // misafire dönülür (açık aktarma diyaloğu ezilmez).
        const migOpen = !this.$('[data-auth]').hidden && this.pendingMigrate !== null;
        this.authUser = null;
        cloudUnbind();
        this.pendingMigrate = null;
        this.pfKey = '';
        if (!migOpen && !this.$('[data-auth]').hidden) this.paintAuth('guest');
      }
    });
    getUser().then((u) => {
      if (!u) return;
      this.authUser = u;
      this.pfKey = '';
      void this.refreshFromCloud();
    }).catch(() => { /* çevrimdışı: misafir */ });
  }

  private openAuth(): void {
    this.authReturn = document.activeElement as HTMLElement | null;
    if (this.$('[data-auth]').hidden) this.$('[data-auth]').hidden = false;
    this.paintAuth(!isAuthAvailable() ? 'unconfigured' : this.authUser ? 'user' : 'guest');
  }

  private paintAuth(status: 'unconfigured' | 'guest' | 'loading' | 'error' | 'user'): void {
    const m = this.$('[data-auth]');
    const lv = levelOf(this.save.xp);
    const eq = this.guard(this.eqSkin());
    const def = SKIN_DEFS[eq] ?? SKIN_DEFS[0];
    m.innerHTML = authHTML({
      status,
      userName: this.authUser?.name ?? '',
      userAvatar: this.authUser?.avatar ?? '',
      userEmail: this.authUser?.email ?? '',
      skinName: def.n,
      skinColor: def.c[0] ?? '#2be7ff',
      level: lv.level,
      coins: this.save.coins,
    });
    m.querySelector('[data-auth-google]')?.addEventListener('click', () => void this.doGoogle());
    m.querySelector('[data-auth-guest]')?.addEventListener('click', () => this.closeAuth());
    m.querySelector('[data-auth-signout]')?.addEventListener('click', () => { this.closeAuth(); void signOut(); });
    m.querySelector('[data-close]')?.addEventListener('click', () => this.closeAuth());
    (m.querySelector<HTMLElement>('[data-auth-google]:not([disabled])')
      ?? m.querySelector<HTMLElement>('[data-auth-signout]')
      ?? m.querySelector<HTMLElement>('[data-close]'))?.focus({ preventScroll: true });
  }

  private async doGoogle(): Promise<void> {
    if (this.authBusy || !isAuthAvailable()) return;
    this.authBusy = true;
    this.paintAuth('loading');
    try {
      // Başarılıysa sayfa OAuth'a gider ve geri döner; hata olursa yakalanır.
      await signInWithGoogle();
    } catch {
      this.paintAuth('error');
    } finally {
      this.authBusy = false;
    }
  }

  private closeAuth(): void {
    const m = this.$('[data-auth]');
    if (m.hidden && !m.innerHTML) return;
    m.hidden = true;
    m.innerHTML = '';
    if (this.authReturn?.isConnected) this.authReturn.focus({ preventScroll: true });
    this.authReturn = null;
  }

  private toast(text: string): void {
    const t = this.root.querySelector<HTMLElement>('.au-toast');
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ── Bulut kayıt (Supabase profiles) ──────────────────────────────────
  // Yükleme/karşılaştırma oturum başına BİR kez çalışır (giriş sonrası veya
  // açılışta oturum varsa). Sonrası işaretle (`snakez.sync`) yönetilir:
  // bulut işaretten oynamamış + yerel değişmişse sessiz yaz, bulut yeniyse
  // ve yerel dokunulmamışsa sessiz indir, ikisi de değişmişse sor. İşaret
  // yoksa (ilk giriş) eski üç durum aynen çalışır.
  private async refreshFromCloud(): Promise<void> {
    const u = this.authUser;
    if (!u || this.refreshing || this.bootDoneUid === u.id) return;
    this.refreshing = true;
    try {
      if (await this.refreshInner(u.id)) this.bootDoneUid = u.id;
    } finally {
      this.refreshing = false;
    }
  }

  private async refreshInner(uid: string): Promise<boolean> {
    cloudBind(uid); // senkron işaretini geri yükler (menü reload kararı için)
    this.cloudUi = 'saving';
    this.pfKey = '';
    const res = await cloudLoad();
    const u = this.authUser;
    if (!u || u.id !== uid) return false; // arada çıkış yapıldı
    if (res.kind === 'error') {
      this.cloudUi = 'error';
      this.pfKey = '';
      return false; // ready açılmadı: kaydetme durur, hap uyarır
    }
    const marker = loadSyncMarker();
    const localSig = snapshotSig();
    if (res.kind === 'empty') {
      const lsum = summarizeLocal();
      if (isBlank(lsum)) {
        // İki taraf da boş: satırı kur, sessizce eşitle.
        cloudSetReady(true);
        if (await cloudPushNow()) this.noteSynced();
        else this.cloudUi = 'error';
        this.pfKey = '';
        return true;
      }
      this.pendingMigrate = { mode: 'upload', local: lsum, remote: null, row: null };
      this.openMigrate();
      return true;
    }
    const row = res.row;
    const lsum = summarizeLocal();
    const rsum = summarizeRow(row);
    if (!marker || !marker.updatedAt) {
      // İlk giriş (işaret yok): mevcut davranış.
      if (sameProgress(lsum, rsum)) {
        cloudSetReady(true);
        this.noteSynced();
        // Güncellemeyle gelen yeni başarımlar sessizce açılır (ör. career
        // anahtarı ilk kez indi). Varsa tek özet duyuru.
        this.announceAch(evalAchievements(this.achCtx(loadCareer())));
        return true;
      }
      if (isBlank(lsum)) {
        // (c) Yerel boş: yedekle, bulutu yaz, yeniden yükle.
        backupLocal('cloud-download');
        writeLocal(row.save_data.keys);
        // İnen kariyerdeki başarımlar sessizce işlenir (duyuru reload'da
        // kaybolacağı için toast yok; Profilim'de açık görünürler).
        try {
          evalAchievements(this.achCtx(loadCareer()));
        } catch {
          /* bozuk kariyer: yeniden yükleme yine olur */
        }
        cloudSetReady(true);
        this.noteSynced();
        location.reload();
        return true;
      }
      this.pendingMigrate = { mode: 'choose', local: lsum, remote: rsum, row };
      this.openMigrate();
      return true;
    }
    if (isSameInstant(row.updated_at, marker.updatedAt)) {
      if (localSig !== marker.sig) {
        // Yerel bulutun devamı (aynı cihazda oynanmış): sessizce,
        // karşılaştır-ve-yaz. Stale → conflicted() diyaloğu açar;
        // error/offline → statüde yazar, sonraki dokunuş dener.
        cloudSetReady(true);
        if (await cloudPushStrict(marker.updatedAt)) this.noteSynced();
      } else {
        // Dokunulmamış: yazacak bir şey yok, ağa çıkma.
        cloudSetReady(true);
        this.noteSynced();
      }
      return true;
    }
    // Bulut işaretten yeni:
    if (localSig === marker.sig) {
      // Yerel dokunulmamış: sessizce indir (diyalog yok).
      backupLocal('cloud-download');
      writeLocal(row.save_data.keys);
      try {
        evalAchievements(this.achCtx(loadCareer()));
      } catch {
        /* bozuk kariyer: yeniden yükleme yine olur */
      }
      cloudSetReady(true);
      this.noteSynced();
      location.reload();
      return true;
    }
    // İki taraf da birbirinden bağımsız değişmiş: kullanıcı seçsin.
    // Coin/XP/skin birleştirilmez (mevcut kural).
    this.pendingMigrate = { mode: 'choose', local: lsum, remote: rsum, row };
    this.openMigrate();
    return true;
  }

  /** Başarılı eşitlemeden sonra gereksiz push/yoklama önlenir. */
  private noteSynced(): void {
    cloudMarkSynced();
    this.lastCloudSig = snapshotSig();
    this.cloudUi = 'ok';
    this.pfKey = '';
  }

  private openMigrate(): void {
    if (!this.pendingMigrate) return;
    this.authReturn = document.activeElement as HTMLElement | null;
    this.$('[data-auth]').hidden = false;
    this.paintMigrate();
  }

  private sideOf(s: ProgSum, title: string, dot: string): SideSum {
    return { title, sub: `Seviye ${s.level} · ${fmt(s.coins)} coin`, dot };
  }

  private paintMigrate(): void {
    const p = this.pendingMigrate;
    if (!p) return;
    const m = this.$('[data-auth]');
    let v: MigrateView;
    if (p.mode === 'upload') {
      v = {
        heading: 'AKTARMA', note: 'Hesabın boş görünüyor.',
        local: { title: 'Bu tarayıcı', sub: `Seviye ${p.local.level} · ${fmt(p.local.coins)} coin`, dot: '#2be7ff' },
        remote: null,
        primaryLabel: 'Hesabıma aktar', primaryAct: 'upload',
        secondaryLabel: 'Sıfırdan başla', secondaryAct: 'fresh',
      };
      v.note = `Bu tarayıcıda Seviye ${p.local.level} · ${fmt(p.local.coins)} coin bulundu. Hesabına aktaralım mı?`;
    } else if (p.mode === 'choose') {
      v = {
        heading: 'DEVAM', note: 'İki farklı ilerleme var. Biriyle devam et (birleştirilmez).',
        local: this.sideOf(p.local, 'Bu tarayıcı', '#2be7ff'),
        remote: p.remote ? this.sideOf(p.remote, 'Hesabın', '#ffd35c') : null,
        primaryLabel: 'Hesaptan devam et', primaryAct: 'cloud',
        secondaryLabel: 'Bu tarayıcıyla devam et', secondaryAct: 'local',
      };
    } else if (p.mode === 'conflict') {
      v = {
        heading: 'ÇAKIŞMA', note: 'Başka bir sekmede daha yeni kayıt var. Hangisi kalsın?',
        local: this.sideOf(p.local, 'Bu sekme', '#2be7ff'),
        remote: p.remote ? this.sideOf(p.remote, 'Bulut', '#ffd35c') : null,
        primaryLabel: 'Hesaptakiyle devam et', primaryAct: 'cloud',
        secondaryLabel: 'Buradakiyle üzerine yaz', secondaryAct: 'force',
      };
    } else {
      v = {
        heading: 'ÇIKIŞ', note: 'Çevrimdışı değişiklikler buluta gönderilemedi.',
        local: this.sideOf(p.local, 'Bu tarayıcı', '#2be7ff'),
        remote: null,
        primaryLabel: 'Yine de çık', primaryAct: 'leave',
        secondaryLabel: 'Vazgeç', secondaryAct: 'cancel',
      };
    }
    m.innerHTML = migrateHTML(v);
    m.querySelectorAll<HTMLElement>('[data-mig]').forEach((b) => b.addEventListener('click', () => void this.migAct(b.dataset.mig!)));
    m.querySelector('[data-close]')?.addEventListener('click', () => this.closeAuth());
    m.querySelector<HTMLElement>('[data-mig]')?.focus({ preventScroll: true });
  }

  private async migAct(cmd: string): Promise<void> {
    const p = this.pendingMigrate;
    if (!p) {
      this.closeAuth();
      return;
    }
    if (cmd === 'cancel') {
      this.closeAuth();
      return;
    }
    if (cmd === 'upload' || cmd === 'local' || cmd === 'force') {
      // Yerel buluta çıkar (force: çakışma bilerek ezilir). Öbür tarafın
      // başarım/seri alanları kaybolmasın diye önce birleştirilir;
      // coin/XP/skin'e dokunulmaz (yerel kazanır).
      if (p.row) {
        try {
          const remoteCareer = parseCareer(p.row.save_data.keys['snakez.career'] ?? null);
          saveCareer(mergeCareer(loadCareer(), remoteCareer));
        } catch {
          /* bozuk uzak kariyer: yerelle devam */
        }
      }
      cloudSetReady(true);
      if (await cloudPushNow()) {
        this.pendingMigrate = null;
        this.noteSynced();
        this.closeAuth();
        this.toast('İlerleme hesaba aktarıldı');
        this.announceAch(evalAchievements(this.achCtx(loadCareer())));
      } else {
        this.closeAuth(); // karar saklı: hapla tekrar açılır
      }
      return;
    }
    if (cmd === 'fresh') {
      // Sıfırdan: yedekle, yereli temizle, boş satırı kur, yeniden yükle.
      // İmza da silinir: boş yerel + eski imza, sonraki açılışta sahte
      // "devam" sayılıp boş veri buluta sessizce çıkmasın.
      backupLocal('fresh-start');
      clearCloudLocal();
      clearSyncMarker();
      cloudSetReady(true);
      await cloudPushNow();
      this.pendingMigrate = null;
      location.reload();
      return;
    }
    if (cmd === 'cloud') {
      // Bulut kazanır: yedekle, başarım/seriyi birleştirip yerele yaz,
      // yeniden yükle. Coin/XP/skin buluttan gelir (birleştirilmez).
      if (!p.row) {
        this.closeAuth();
        return;
      }
      backupLocal(p.mode === 'conflict' ? 'conflict-cloud' : 'cloud-download');
      const rk = { ...p.row.save_data.keys };
      try {
        rk['snakez.career'] = JSON.stringify(mergeCareer(parseCareer(rk['snakez.career'] ?? null), loadCareer()));
      } catch {
        /* bozuk kariyer: bulut aynen yazılır */
      }
      writeLocal(rk);
      cloudSetReady(true);
      this.noteSynced();
      this.pendingMigrate = null;
      location.reload();
      return;
    }
    if (cmd === 'leave') {
      this.pendingMigrate = null;
      await this.finishSignOut(true);
    }
  }

  /** Çıkış: önce bekleyeni gönder; gönderilemezse uyar, karar kullanıcıda. */
  private async signOutFlow(): Promise<void> {
    const flushed = await cloudSaveNow(8000);
    if (flushed || !cloudHasPending()) {
      await this.finishSignOut(true);
      return;
    }
    this.pendingMigrate = { mode: 'signout-warn', local: summarizeLocal(), remote: null, row: null };
    this.openMigrate();
  }

  private async finishSignOut(clear: boolean): Promise<void> {
    if (clear) {
      clearCloudLocal();
      // Eski imza kalırsa sonraki giriş yanlış "devam" sanır: birlikte sil.
      clearSyncMarker();
    }
    cloudUnbind();
    try {
      await signOut();
    } catch {
      /* yerelden çıkış yine yapılır */
    }
    this.authUser = null;
    location.reload();
  }

  // ── Günlük sandık ────────────────────────────────────────────────
  // Akış: pf çipindeki sandık butonu → modal (kapalı sandık + AÇ) →
  // ödül ÖNCE kaydedilir (claimChest durumu yazar), sonra uygulanır ve
  // gösterilir. Modal kapanırsa bile ödül kaybolmaz.
  /** Saat geri alınmışsa (kayıtlı gün gelecekte) hak YOK — seri korunur. */
  private chestBlocked(): boolean {
    try {
      return loadChest().last > dayStr();
    } catch {
      return false;
    }
  }
  private chest(): void {
    const st = chestStatus();
    const blocked = this.chestBlocked();
    this.paintChest(null, st.streak, blocked ? 'Yarın tekrar gel' : st.ready ? '' : countdown(st.msLeft), st.ready && !blocked, !st.ready && !blocked && this.save.coins >= 100);
  }
  private paintChest(
    reward: { label: string; color: string; rarity: ChestRarity; coins: number } | null,
    streak: number,
    cd: string,
    canOpen: boolean,
    lucky: boolean,
  ): void {
    this.stopChestFx();
    const own = this.save.own;
    const epk = epikPool(own);
    const ndr = nadirPool(own);
    const availW = Object.keys(SPECIAL_W).filter((k) => ndr.includes(k)).reduce((a, k) => a + SPECIAL_W[k], 0);
    const restN = ndr.filter((k) => !(k in SPECIAL_W)).length;
    const restShare = restN ? ((22 - availW) / restN).toFixed(1) : '0';
    const epkShare = epk.length ? (6 / epk.length).toFixed(1) : '0';
    const pool = chestPool(own).map((k) => {
      const ro = rarityOf(k);
      const share = k in SPECIAL_W && ndr.includes(k) ? SPECIAL_SHARE[k] : ro === 'epik' ? '%' + epkShare : '%' + restShare;
      return { label: nameOf(k), rarity: ro === 'epik' ? 'epik' : 'nadir', share };
    });
    const bdSpecials = Object.keys(SPECIAL_W).filter((k) => ndr.includes(k)).map((k) => ({ label: nameOf(k), w: SPECIAL_W[k], share: SPECIAL_SHARE[k] }));
    const bd = { rest: restShare, epik: epkShare, restN, epikN: epk.length, specials: bdSpecials };
    const m = this.mount('[data-chest]', chestHTML(reward, streak, cd, canOpen, lucky, pool, bd));
    m.classList.toggle('is-wait', !reward && !canOpen);
    // Tam ekran parçacık tuvali + flaş (modal kökte; kart içinde değil ki
    // ışınlar tüm ekranı kaplasın). burst desenindeki gibi pointer-events yok.
    let fx = m.querySelector('canvas.ch-fx');
    if (reward && !fx) {
      fx = document.createElement('canvas');
      fx.className = 'ch-fx';
      fx.setAttribute('aria-hidden', 'true');
      m.prepend(fx);
    }
    if (reward && !m.querySelector('.ch-flash')) {
      const fl = document.createElement('div');
      fl.className = 'ch-flash';
      fl.setAttribute('aria-hidden', 'true');
      m.prepend(fl);
    }
    m.dataset.view = reward ? 'open' : canOpen ? 'idle' : 'wait';
    if (reward) m.dataset.kind = reward.rarity === 'coin' ? 'coins' : 'cosmetic';
    else m.removeAttribute('data-kind');
    // Bekleme görünümü: dakikada bir tazele; gece yarısı "hazır"a döner.
    // Tek timeout, modal kapanınca iptal (kalıcı interval yok).
    if (!reward && !canOpen && !this.chestBlocked()) {
      this.chestTimer = window.setTimeout(() => { this.chestTimer = 0; this.chest(); }, 60000);
    }
    m.querySelector('[data-lucky]')?.addEventListener('click', () => {
      // Şanslı sandık: 100 coin karşılığı aynı şansla ikinci hak (seri artmaz).
      if (this.save.coins < 100) return;
      const cur = loadChest();
      if (cur.last !== dayStr() || cur.extra) return;
      this.save.coins -= 100;
      try { localStorage.setItem('snakez.chest', JSON.stringify({ last: cur.last, streak: cur.streak, extra: true })); } catch { /* gizli mod */ }
      store(this.save);
      cloudTouch(); // sandık hakkı: durum buluta kuyruğa girer
      this.lvKey = ''; this.pfKey = '';
      this.chest();
    });
    m.querySelector('[data-chest-open]')?.addEventListener('click', () => {
      // Çift-tık / çift-sekme guardı: hak yeniden kontrol edilir.
      if (this.chestBusy) return;
      const chk = chestStatus();
      if (!chk.ready || this.chestBlocked()) {
this.paintChest(null, chk.streak, this.chestBlocked() ? 'Yarın tekrar gel' : countdown(chk.msLeft), false, false);
        return;
      }
      this.chestBusy = true;
      const { reward: r, streak: ns } = claimChest(this.save.own);
      if (r.kind === 'coins') this.save.coins += r.coins;
      else {
        this.save.own.push(r.key);
        this.equip(r.key);
        this.fresh = r.key;
      }
      store(this.save);
      cloudTouch(); // sandık ödülü: durum buluta kuyruğa girer
      this.lvKey = ''; this.pfKey = '';
      // Havuzda efsanevi yoktur; tip daraltması güvence içindir.
      const ro = rarityOf(r.key);
      const rarity: ChestRarity = ro === 'epik' ? 'epik' : ro === 'coin' ? 'coin' : 'nadir';
      const st2 = chestStatus();
this.paintChest({ label: r.label, color: r.color, rarity, coins: r.coins }, ns, countdown(st2.msLeft), false, false);
      const card = m.querySelector<HTMLElement>('.mt-card.ch');
      if (card) {
        this.chestFx = startChestFx(card, m, { tier: rarity === 'coin' ? 'coin' : rarity, coins: r.coins });
      }
      this.chestBusy = false;
    });
    m.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => b.addEventListener('click', () => this.act(b.dataset.act!)));
    (m.querySelector<HTMLElement>('[data-chest-open]') ?? m.querySelector<HTMLElement>('[data-close]')!).focus();
  }

  // ── Market: görünümler + efektler + güçlendirmeler ───────────────────
  private owns(id: string): boolean { return Array.isArray(this.save.own) && this.save.own.includes(id); }
  /** Sahip olunmayan özel görünüm oynanamaz: Lavanta'ya düşer. */
  private guard(skin: number): number {
    const s = skinByIdx(skin);
    // skinByIdx tanımsızsa (bozuk kayıt/elle yazım) skin aynen geçiyordu ve
    // Game.play OOB indexle çağrılıyordu. Tanınmayan her değer 0'a düşer.
    if (!s) return 0;
    return !this.owns('skin:' + s.id) ? 0 : skin;
  }
  private applyFx(s: Snake | null): void {
    if (s) setSnakeFx(s, fxById(this.save.eqFx)?.cfg ?? null);
  }
  private eqSkin(): number {
    const n = Number(localStorage.getItem('snakez.skin') || 0);
    return Number.isFinite(n) ? n : 0;
  }

  private applyLook(): void {
    const s = this.save, nm = ANIM[s.eqName] ? s.eqName : lookById(SHOP_NAMES, s.eqName)?.color ?? '';
    setLook(s.eqFrame, nm);
    this.lvKey = ''; this.pfKey = '';
  }

  private shop(note = '', anim = true, hl = ''): void {
    this.disposeShop?.();
    const sc = anim ? 0 : this.$('[data-shop] .mk-body')?.scrollTop ?? 0;
    const eq = this.guard(this.eqSkin()), def = SKIN_DEFS[eq] ?? SKIN_DEFS[0], sp = skinByIdx(eq), fresh = this.fresh;
    this.fresh = '';
    const m = this.mount('[data-shop]', shopHTML(this.save, {
      tab: this.tab, note, thumbs: THUMBS, eqSkin: eq, deal: dealKey(), anim, hl, fresh,
      hero: { name: sp?.name ?? def.n, color: def.c[0] },
    }));
    this.disposeShop = bindShop(m, { colors: sp ? [def.c[0]] : def.c, img: sp ? THUMBS[sp.id] : undefined, fxId: this.save.eqFx, title: sp?.name ?? def.n, skin: eq },
      THUMBS, (idx) => SKIN_DEFS[idx]?.c ?? ['#ffffff']);
    m.querySelectorAll<HTMLElement>('[data-do]').forEach((b) => b.addEventListener('click', () => this.doShop(b.dataset.do!)));
    const bd = m.querySelector<HTMLElement>('.mk-body');
    if (bd) bd.scrollTop = sc;
    const c = m.querySelector<HTMLElement>('[data-coins] b'), to = this.save.coins, from = this.shownCoins;
    if (c && from >= 0 && from !== to) this.countCoins(c, from, to);
    this.shownCoins = to;
    const fc = m.querySelector<HTMLElement>('.mk-card.fresh'), cv = m.querySelector<HTMLCanvasElement>('canvas.mk-conf');
    if (fc && cv) burst(cv, fc.style.getPropertyValue('--r') || '#ffd35c');
    if (hl) m.querySelector('.mk-card.hl')?.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
    (m.querySelector<HTMLElement>('.mk-tabs .on') ?? m.querySelector<HTMLElement>('[data-close]'))!.focus({ preventScroll: true });
  }

  private countCoins(el: HTMLElement, from: number, to: number): void {
    const t0 = performance.now(), d = reduce() ? 1 : 700, host = el.parentElement!;
    if (to < from) {
      const f = document.createElement('i');
      f.className = 'cfly'; f.textContent = `-${fmt(from - to)}`; host.appendChild(f);
      window.setTimeout(() => f.remove(), 1000);
    }
    const step = (t: number): void => {
      const p = Math.min(1, (t - t0) / d);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Bir ürünü kullanıma al (görünüm / efekt / isim rengi / çerçeve). */
  private equip(key: string): void {
    const [k, id] = key.split(':'), s = this.save;
    if (k === 'skin') this.equipSkin(id);
    else if (k === 'fx') { s.eqFx = id; this.applyFx(this.game.me); }
    else if (k === 'name') { s.eqName = id; this.applyLook(); }
    else if (k === 'frame') { s.eqFrame = id; this.applyLook(); }
  }

  private doShop(cmd: string): void {
    const [op, ...rest] = cmd.split(':'), key = rest.join(':'), s = this.save;
    if (op === 'tab') { this.tab = key as Tab; this.shop('', true); return; }
    if (op === 'deal') { const dk = dealKey(); this.tab = tabOf(dk); this.shop('', true, dk); return; }
    if (op === 'off') {
      if (key === 'fx') { s.eqFx = ''; this.applyFx(this.game.me); } else if (key === 'name') { s.eqName = ''; this.applyLook(); } else if (key === 'frame') { s.eqFrame = ''; this.applyLook(); }
      store(s); cloudTouch(); this.shop('Çıkarıldı.', false); return;
    }
    if (op === 'use') { this.equip(key); store(s); cloudTouch(); this.shop('Kullanıma alındı.', false); return; }
    if (op !== 'buy') return;
    const boost = key.startsWith('boost:') ? ITEMS.find((i) => i.id === key.slice(6)) : undefined;
    const price = boost ? boost.price : priceFor(key, basePrice(key), dealKey());
    if (!boost && !basePrice(key)) return;
    if (s.coins < price) { this.shop('Yetersiz coin — bir tur daha oyna.', false); return; }
    s.coins -= price;
    if (boost) {
      if (boost.id === 'xb') s.xb = Math.min(9, s.xb + 3); else if (boost.id === 'cb') s.cb = Math.min(9, s.cb + 3); else s.xp += 500;
    // Olay sahteciliğinde çift satın alma aynı anahtarı iki kez yazıyordu
    // (UI gizlese de data-do elle tetiklenebilir). Tekrarı yut.
    } else { if (!s.own.includes(key)) { s.own.push(key); this.fresh = key; } this.equip(key); }
    store(s); cloudTouch(); this.lvKey = ''; this.pfKey = '';
    this.shop('Satın alındı! Kullanıma hazır.', false);
  }

  /** Menü açıksa şeritteki ilgili yuvaya tıklar (menü kendi seçimini/kaydını yapar); değilse sadece kaydeder. */
  private equipSkin(id: string): void {
    const sk = SHOP_SKINS.find((x) => x.id === id);
    // Sahte/eskimiş id non-null assert'te patlıyordu (!). Sessizce yut.
    if (!sk) return;
    const chip = this.menuChips()[sk.idx];
    if (chip) chip.click(); else saveSkin(sk.idx);
  }

  // ── Menü: kilitli özel görünümleri işaretle, kilitliye tıklayınca marketi aç ──
  private menuChips(): HTMLElement[] {
    const strip = document.querySelector<HTMLElement>('[data-strip]');
    return strip ? Array.from(strip.children) as HTMLElement[] : [];
  }
  private decorateMenu(): void {
    const chips = this.menuChips();
    if (chips.length < SKIN_DEFS.length) return;
    for (const sk of SHOP_SKINS) {
      const c = chips[sk.idx], locked = !this.owns('skin:' + sk.id);
      c.classList.toggle('mt-locked', locked);
      if (!c.dataset.mtHook) {
        c.dataset.mtHook = '1';
        c.addEventListener('click', (e) => {
          if (this.owns('skin:' + sk.id)) return;
          e.stopImmediatePropagation(); e.preventDefault();
          this.tab = 'skin'; this.shop('Bu görünüm kilitli. Coin ile satın al.');
        }, true);
      }
    }
  }
}

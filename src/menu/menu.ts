// Ana menü — "VİTRİN".
//
// Kompozisyon: dev bir yılan ekranı boydan boya yüzer, marka ve metin onun
// üstünde sol sütunda durur. Kart yok, panel yok — katmanlar kenarlara
// dayanan tam genişlik gradyanlardır, bu yüzden hiçbir yerde kutu izi olmaz.
//
// Menü arka planı MOTORUN KENDİ DÖNGÜSÜDÜR: `Game.play()` çağrılmaz,
// `game.me` null kalır, `Game.render()` zaten var olan `this.watch` yoluna
// düşer. Vitrin ise oyunun gerçek renderer'ını (drawSnakeBody) kullanır.
// Motor dosyalarının HİÇBİR satırı değişmemiştir.
import './menu.css';
import { SKIN_DEFS } from '../utils/Constants.ts';
import type { Game } from '../core/Game.ts';
import { arenaTable } from './arena.ts';
import type { LeaderRow } from './arena.ts';
import { NAME_MAX, cleanName, loadProfile, saveName, saveSkin } from './storage.ts';
import { Vitrine, paintSwatch } from './vitrine.ts';
import { fpsOn, fxMode, qMode, setFpsOn, setFxMode, setQuality } from '../utils/settings.ts';
import type { FxMode, Quality } from '../utils/settings.ts';
import { setFpsMeter } from '../utils/fps.ts';
import { brand } from './brand.ts';
import { initLogoFx, initBoardFx } from './logoFx.ts';

const ROWS = 4;
const POLL_MS = 300;

// Logo: kullanıcının verdiği neon görsel (1983×793). Şeffaf kenarları
// kırpılıp 720×455 WebP'ye indirildi → `public/logo.webp` (55 KB; PNG
// karşılığı 314 KB'tı, WebP evrensel olduğu için tek format yeterli).
// Görselin İÇİNDE "Snakez.io" + "YILAN ARENASI" yazdığı için ayrı
// `.mn-word` metin bloğu KALDIRILDI — logo ismi iki kez yazılmaz.
//
// Logo görünümü: SVG + maskeli RGB tarama + canvas'ta dış hattı
// izleyen RGB neon. Görsel `logo.webp` değişmez; etki `./logoFx.ts`.
//   .mn-logo       sargı (konum/boyut çapası)
const SHELL = `
  <canvas class="mn-cv" aria-hidden="true"></canvas>
  <div class="mn-scrim" aria-hidden="true"></div>

  <header class="mn-brand">
    <span class="mn-logo">
      <svg viewBox="0 0 720 455" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Snakez.io">
        <defs>
          <mask id="logoMask" mask-type="alpha">
            <image href="/logo.webp" width="720" height="455"/>
          </mask>
          <!-- RGB IŞIK TARAMASI: mor -> cyan -> yesil serit, soldan saga -->
          <linearGradient id="sweepGrad" gradientUnits="userSpaceOnUse" x1="-250" y1="-60" x2="0" y2="60">
            <stop offset="0"   stop-color="#a855f7" stop-opacity="0"/>
            <stop offset=".3"  stop-color="#a855f7" stop-opacity=".8"/>
            <stop offset=".55" stop-color="#22d3ee" stop-opacity=".85"/>
            <stop offset=".8"  stop-color="#34f5a0" stop-opacity=".8"/>
            <stop offset="1"   stop-color="#34f5a0" stop-opacity="0"/>
            <animateTransform attributeName="gradientTransform" type="translate" dur="6s" repeatCount="indefinite"
              values="-60 0; 1089 0; 1089 0" keyTimes="0; .45; 1"
              calcMode="spline" keySplines=".4 0 .6 1; 0 0 1 1"/>
          </linearGradient>
        </defs>
        <image href="/logo.webp" width="720" height="455"
               alt="Snakez.io — Yılan arenası"/>
        <rect width="720" height="455" fill="url(#sweepGrad)" mask="url(#logoMask)" style="mix-blend-mode:screen"/>
      </svg>
      <canvas></canvas>
    </span>
  </header>

  <section class="mn-copy">
    <h1 class="mn-head">Büyü. Yakala.<br>Sıralamaya tırman.</h1>
    <p class="mn-sub">Tek kişilik. Otuz rakip. Tek hayat.</p>
  </section>

  <aside class="mn-board" aria-labelledby="mn-bt">
    <!-- Kart içi gradyan: ambleminkiyle aynı tanım, ayrı id. -->
    <svg width="0" height="0" aria-hidden="true" focusable="false"
         style="position:absolute">
      <defs>
        <linearGradient id="mg-board" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="${brand()[0]}"/>
          <stop offset=".55" stop-color="${brand()[1]}"/>
          <stop offset="1" stop-color="${brand()[2]}"/>
        </linearGradient>
      </defs>
    </svg>
    <h2 class="mn-bt" id="mn-bt">
      <svg class="mn-crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 7.5l4.4 3.4L12 4.6l4.6 6.3L21 7.5l-1.5 9.2a1.2 1.2 0 0 1-1.2 1H5.7a1.2 1.2 0 0 1-1.2-1L3 7.5z"/>
      </svg>
      LİDERLİK
      <i class="mn-live" aria-hidden="true"></i>
    </h2>
    <ol class="mn-list" data-list></ol>
    <p class="mn-lead">
      Arenanın en büyüğü
      <svg class="mn-crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 7.5l4.4 3.4L12 4.6l4.6 6.3L21 7.5l-1.5 9.2a1.2 1.2 0 0 1-1.2 1H5.7a1.2 1.2 0 0 1-1.2-1L3 7.5z"/>
      </svg>
    </p>
    <!-- EFEKT 1: kartın üzerinden geçen RGB tarama şeridi (6sn döngü).
         Kartın overflow:hidden + border-radius sınırı biçimi keser. -->
    <div class="mn-scan" aria-hidden="true"></div>
  </aside>

  <!-- EFEKT 2: tek canvas, hover edilen satır/kart üzerine taşınır.
       Kartın DIŞINDA durur ki 28px'lik parlama kesilmesin. -->
  <canvas class="mn-row-fx" aria-hidden="true"></canvas>

  <footer class="mn-deck">
    <label class="mn-field">
      <span>ADIN</span>
      <input data-name type="text" maxlength="${NAME_MAX * 2}" autocomplete="off"
             autocapitalize="off" spellcheck="false" placeholder="İsmini yaz">
    </label>

    <div class="mn-skins">
      <span class="mn-lbl">GÖRÜNÜM</span>
      <div class="mn-strip" role="radiogroup" aria-label="Görünüm" data-strip></div>
    </div>

    <button class="mn-go" data-go type="button">OYNA</button>
  </footer>

  <p class="mn-keys">
    <span><kbd>Fare</kbd> yön</span>
    <span><kbd>Sol tık</kbd><kbd>Boşluk</kbd> hızlan</span>
  </p>

  <div class="mn-tele">
    <button class="mn-stats" data-stats type="button" aria-label="Profilim">
      <span><em>REKOR</em><b data-best>0</b></span>
      <span><em>OYUN</em><b data-games>0</b></span>
      <span><em>SIRA</em><b data-rank>—</b></span>
      <span class="mn-hint" aria-hidden="true">Profilim →</span>
    </button>
    <span class="mn-ver">v2.5</span>
    <button class="mn-gear" data-gear type="button" aria-label="Ayarlar" aria-haspopup="dialog">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
  </div>

  <!-- ── AYARLAR ────────────────────────────────────────────────────────
       Efekt anahtarı: Otomatik (sistemi izler) / Açık / Kapalı.
       utils/settings.ts'e yazar; oyun içi her şey canlı okur. -->
  <div class="mn-set" data-set hidden role="dialog" aria-modal="true" aria-labelledby="mn-sett">
    <h2 id="mn-sett">AYARLAR</h2>
    <p class="mn-setsub">Efektler</p>
    <div class="mn-setopts" role="radiogroup" aria-label="Efektler">
      <button data-fxopt="auto" type="button" role="radio" aria-checked="false">Otomatik</button>
      <button data-fxopt="on" type="button" role="radio" aria-checked="false">Açık</button>
      <button data-fxopt="off" type="button" role="radio" aria-checked="false">Kapalı</button>
    </div>
    <p class="mn-note">Otomatik: sistem ayarını izler.</p>
    <p class="mn-setsub">Kalite</p>
    <div class="mn-setopts" role="radiogroup" aria-label="Kalite">
      <button data-q="low" type="button" role="radio" aria-checked="false">Düşük</button>
      <button data-q="med" type="button" role="radio" aria-checked="false">Orta</button>
      <button data-q="high" type="button" role="radio" aria-checked="false">Yüksek</button>
    </div>
    <p class="mn-note">Düşük: parçacık az, parlama ve gölge kapalı.</p>
    <button class="mn-setrow" data-fps type="button" role="switch" aria-checked="false">FPS göstergesi: <b>Kapalı</b></button>
    <p class="mn-note">Sayaç sağ üstte, menüde ve oyunda görünür.</p>
    <button class="mn-setclose" data-setclose type="button">Kapat</button>
  </div>

  <!-- ── AD LEVHASI ─────────────────────────────────────────────────────
       Önizleme modunda seçili skin'in adı, vitrin yılanının başının
       altında belirir. Konumunu Vitrine.placeLabel() her karede yazar
       (deck/leaderboard dikdörtgenlerine göre bantlanmış olduğu için
       hiçbir genişlikte üst üste binmez). Başlıktaki iki satır İSE
       canvas'ta değil, DOM'da: web fontu ve harf aralığı orada net. -->
  <div class="mn-hero" data-heroname aria-hidden="true">
    <em>SEÇİLEN GÖRÜNÜM</em>
    <b data-heroname-txt></b>
  </div>
`;

function num(n: number): string {
  return n.toLocaleString('tr-TR');
}

export class Menu {
  private root: HTMLElement;
  private game: Game;
  private vitrine: Vitrine;
  private list: HTMLElement;
  private input: HTMLInputElement;
  private setEl: HTMLElement;
  private chips: HTMLElement[] = [];
  private best: HTMLElement;
  private games: HTMLElement;
  private rank: HTMLElement;
  private timer = 0;
  private skin = 0;
  /**
   * Kahramanın kilidini TETİKLEYEN nedenler:
   *
   *   hover  — imleç GÖRÜNÜM şeridinin üzerinde,
   *   pinned — kullanıcı bir skin SEÇTİ ve henüz menüde başka bir şeye
   *            tıklamadı/odaklanmadı.
   *
   * `focus` YOK (önceki turda ölçülen hata): yuvaya tıklamak o yuvaya odak
   * verir, kurucuda da programatik olarak bir yuvaya odak verildiği için
   * `focusout` hiç tetiklenmez ve yılan sonsuza dek donardı.
   *
   * Eski üçüncü kaynak 1.6 sn'lik bir zamanlayıcıydı (`grace`) — süre
   * dolunca yılan TAM DA kullanıcı önizlemeye bakarken kalkıyordu ve
   * "skin seçimi yılan hareket ediyor" şikâyeti doğdu. Yerine `pinned`
   * geldi: kilit, kullanıcı menüde başka bir şeye tıkladığı ya da oraya
   * odaklandığı an kalkar. Bekleme süresi yok → yanlış anda kalkma yok.
   */
  private holdWhy = { hover: false, pinned: false };
  private fitTimer = 0;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private fxOff: Array<() => void> = [];
  private skinsEl: HTMLElement | null = null;

  constructor(root: HTMLElement, game: Game, onStart: (name: string, skin: number) => void) {
    this.root = root;
    this.game = game;
    root.innerHTML = SHELL;
    this.fxOff.push(initLogoFx(root), initBoardFx(root));

    this.list = root.querySelector('[data-list]')!;
    this.input = root.querySelector('[data-name]') as HTMLInputElement;
    this.setEl = root.querySelector('[data-set]')!;
    this.best = root.querySelector('[data-best]')!;
    this.games = root.querySelector('[data-games]')!;
    this.rank = root.querySelector('[data-rank]')!;

    const p = loadProfile(SKIN_DEFS.length);
    this.input.value = p.name;
    this.best.textContent = num(p.best);
    this.games.textContent = num(p.games);
    this.skin = p.skin;

    this.vitrine = new Vitrine(root.querySelector('.mn-cv') as HTMLCanvasElement);
    this.vitrine.setSkin(this.skin);
    this.vitrine.setLabel(root.querySelector('[data-heroname]'));
    this.vitrine.start();
    this.vitrine.watchVisibility();

    this.buildSkins();
    this.swatchObserver();
    // Başlangıç seçimi PINNED DEĞİL: sayfa açılırken hiçbir kullanıcı
    // etkileşimi olmadan kilitlenmemeli — vitrin ilk anda akmalı.
    this.selectSkin(this.skin, false, false);
    this.bind(onStart);
    this.fitCopy(); // hemen dene (ilk açılışta doğru olsun)
    this.scheduleFit(); // + animasyon/font bittikten sonra temiz ölç
    // Web fontu yüklenene kadar başlık GERÇEK ölçüyle çizilmez; o zaman
    // yapılan hesap yanlış kalır. Font gelince yeniden hesapla.
    document.fonts?.ready
      .then(() => {
        this.fitCopy();
        this.scheduleFit();
      })
      .catch(() => {});
    this.watchDeck(); // bant yüksekliği değişince yeniden ölç (resize bunu yakalamaz)
    this.paint();
    this.timer = window.setInterval(() => this.paint(), POLL_MS);
  }

  /**
   * Başlık ile bandın arasını açar.
   *
   * `.mn-copy` `top:44%` ile, `.mn-deck` alttan sabit konumlanıyor; ikisi
   * de mutlak olduğu için kısa ekranlarda ÜST ÜSTE BİNİYORDU. Ölçülen
   * gerçek çakışmalar:
   *
   *   1366x768 -> 52px   1600x900 -> 19px   1024x768 -> 78px
   *   1280x800 -> 28px   1536x864 -> 39px   1152x800 -> 18px
   *
   * `max-height` eşiği bunu çözmez: üstteki yüzde hiçbir genişlikte
   * tutmuyor çünkü başlık satır sayısı genişliğe göre değişiyor
   * (aynı 900px yükseklikte 1440px'te kâfken 1600px'te bir satır fazla
   * yazıyor). Bu yüzden yerel olarak ölçülüp gerekiyorsa yukarı çekiliyor.
   *
   * Ölçüm ANİMASYONDAN BAĞIMSIZ: `offsetTop`/`offsetHeight` layout
   * tabanlıdır, `transform`'a bakmaz. Giriş animasyonu sırasında
   * `translateY(12px)` olsa bile doğru son konumu verir — yani kıpırtı yok.
   */
  private fitCopy(): void {
    const copy = this.root.querySelector('.mn-copy') as HTMLElement | null;
    const deck = this.root.querySelector('.mn-deck') as HTMLElement | null;
    if (!copy || !deck) return;

    // Ad levhasının SOL SINIRI = deck'in sağ kenarı + 24px pay.
    // `fitCopy` zaten deck'i ölçtüğü için besleme noktası burası — ayrı bir
    // ResizeObserver'a gerek yok. Bu sayede levha 1920'de 522px, 1024'te
    // 485px olan deck kenarının hiçbirinde üstüne binmiyor.
    this.vitrine.setSafeLeft(deck.getBoundingClientRect().right + 24);

    // SIRASI ÖNEMLİ: `transition` ÖNCE kapatılır, `top` SONRA temizlenir.
    // Aksi hâlde temizleme bir geçiş başlatır ve hemen altındaki okuma
    // geçişin ORADAKİ (eski) değerini yakalar -> `delta` 0 çıkar -> fonksiyon
    // `top`'u boş bırakıp döner ve başlık `44%`'e düşerek bantla biner.
    // (menu.css'teki `.mn-copy { transition-property: none }` bunu zaten
    // engelliyor; buradaki zırh, CSS kuralı bir gün kalkarsa diye.)
    const keepTransition = copy.style.transitionProperty;
    copy.style.transitionProperty = 'none';
    copy.style.top = '';      // önce CSS'e dön (resize'te eski px değer kalmasın)
    copy.style.display = '';  // ... ve eskiden gizlendiyse GERİ AÇ
    const cs = getComputedStyle(copy);
    const cssHidden = cs.display === 'none';
    const topPx = parseFloat(cs.top);
    copy.style.transitionProperty = keepTransition;

    // `!isFinite`: mobilde `top: auto` → `parseFloat` NaN. Eski kod `|| 0`
    // ile devam edip deck konumuna göre tamamen saçma bir `top` yazabiliyordu.
    if (cssHidden || !Number.isFinite(topPx)) return;

    const half = copy.offsetHeight / 2;
    const GAP = 26;       // hedef pay: başlık ↔ destek
    const MIN_GAP = 8;    // ödün verilebilecek EN AZ pay
    const BRAND_GAP = 18; // pay: logo ↔ başlık — ödün verilmez

    // `mn-in-mid` `translateY(-50%)` ile biter → CSS `top` değeri görsel
    // MERKEZ çizgisidir; kutunun kenarları `center ± h/2`.
    let center = topPx;
    if (center + half > deck.offsetTop - GAP) center = deck.offsetTop - GAP - half;

    // ── ALT SINIR (DÜZELTME) ─────────────────────────────────────────────
    // Eski kod `floor = brandBottom + 18` değerini `next` ile — yani
    // MERKEZLE — karşılaştırıyordu. Oysa `floor` bir ÜST KENAR sınırı;
    // `translateY(-50%)` hesaba katılmadığı için sınır `h/2` kadar
    // GEVŞEKTİ. 1366x768'de ölçülen sonuç: başlık, logonun alt kenarının
    // 9px İÇİNE girmişti (`floor` 211, ama görsel üst 184).
    // Doğrusu: görsel üst (`center - h/2`) sınırın altında kalamaz.
    const brand = this.root.querySelector('.mn-brand') as HTMLElement | null;
    const brandBottom = brand ? brand.offsetTop + brand.offsetHeight : 0;
    const loCenter = brandBottom + BRAND_GAP + half;

    if (center < loCenter) {
      center = loCenter;
      // Bu konum desteğin payını eritmiş mi? Eritiyorsa başlığı gizlemek
      // yerine payı `GAP`'ten `MIN_GAP`'e daraltıp göstermeyi tercih et —
      // yalnızca gerçekten sığmıyorsa gizle.
      // (Eski kodda `display: none` bir kez yazılınca HİÇ sıfırlanmıyordu:
      // sonraki her ölçümde `display === 'none'` diye erken dönüyor ve
      // başlık sonsuza dek gizli kalıyordu. Artık her ölçümde açılır.)
      if (center + half > deck.offsetTop - MIN_GAP) {
        copy.style.display = 'none';
        return;
      }
    }
    if (center === topPx) return; // dokunulmadı → CSS'teki `%` değeri korunur
    copy.style.top = center + 'px';
  }

  /**
   * Animasyon/font bittikten sonra bir kez daha ölçer.
   *
   * `fitCopy` deterministik olduğu için tekrar aynı sonucu verir
   * (idempotent) — bu çağrı yalnızca `.mn-copy`'nin yüksekliği font gelince
   * değiştiğinde işe yarar (ör. başlık 2 satırdan 3 satıra düşüp +62px
   * büyüdüğünde ilk ölçüm artık geçersiz olur).
   */
  private scheduleFit(): void {
    window.clearTimeout(this.fitTimer);
    this.fitTimer = window.setTimeout(() => this.fitCopy(), 950);
  }

  /**
   * Bant yüksekliği herhangi bir sebeple değişince başlığı yeniden konumlar.
   *
   * `resize` bunları YAKALAMAZ: şerit satır sayısı genişliğe göre 2/3
   * değişir, web fontu gelince hem başlık hem bant büyür ama pencere boyu
   * aynı kalır. Bu yüzden `.mn-deck` ve `.mn-copy` doğrudan izlenir.
   *
   * Döngü yok: `fitCopy` yalnızca `.mn-copy`'nin `top` değerini değiştirir;
   * bu da hiçbirinin İÇERİK kutusunu etkilemez, dolayısıyla ResizeObserver
   * tekrar tetiklenmez.
   */
  private watchDeck(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const deck = this.root.querySelector('.mn-deck');
    const copy = this.root.querySelector('.mn-copy');
    if (!deck || !copy) return;
    const ro = new ResizeObserver(() => this.fitCopy());
    ro.observe(deck);
    ro.observe(copy);
    this.ro = ro;
  }

  // ── Görünüm seçimi ───────────────────────────────────────────────────
  // Vitrin bir yılan gösterdiği için "bu benim yılanım" sorusunun cevabı
  // burada verilmelidir. Yuva başına GERÇEK gövde çizilir (zebra, gökkuşağı,
  // bayrak desenleri görünür), ama tek seferlik: 15 çizim, bir kez.
  private buildSkins(): void {
    const strip = this.root.querySelector('[data-strip]') as HTMLElement;
    SKIN_DEFS.forEach((def, i) => {
      const b = document.createElement('button');
      b.className = 'mn-chip';
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', def.n);
      b.title = def.n;
      b.dataset.i = String(i);
      const cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      // Yuva daraldı: ölçek de oranla kalsın, gövde taşmasın.
      const lbl = document.createElement('u');
      lbl.textContent = def.n;
      b.append(cv, lbl);
      strip.append(b);
      this.chips.push(b);
    });
    // Yerleşim bitince ölçü al, sonra çiz (clientWidth sıfır olmasın).
    this.paintSkins();
  }

  paintSkins(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.chips.forEach((b, i) => {
      const cv = b.querySelector('canvas') as HTMLCanvasElement;
      if (cv.clientWidth > 0) paintSwatch(cv, i, dpr);
    });
  }

  /** Yuva görünür olduğunda ilk kez çizilir. Kısa ekranda `.mn-skins`
   *  gizlenir; ekran büyüyünce ilk buraya girer ve ölçüsü hazırdır. */
  private swatchObserver(): void {
    // stop()'ta sökülebilmesi için saklanır: kesişim hiç olmazsa
    // yerel değişken çöpte kaybolup gözlemci sızıyordu.
    this.io?.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            this.paintSkins();
            io.disconnect();
            if (this.io === io) this.io = null;
          }
        }
      },
      { root: document.getElementById('menu') },
    );
    this.io = io;
    const strip = this.root.querySelector('[data-strip]');
    if (strip) io.observe(strip);
  }

  /**
   * @param reveal  Seçili yuva görünür alanda değilse kaydırılsın mı?
   *   Tıklama: HAYIR — kullanıcı zaten tıkladığı yuvayı görüyor; kaydırma
   *   şeridi "kayıp gidiyor" gibi gösteriyordu.
   *   Klavye: EVET — ok tuşlarıyla ilerlerken seçim ekran dışına çıkabilir.
   */
  private selectSkin(i: number, reveal = false, pin = true): void {
    this.skin = i;
    saveSkin(i);
    this.vitrine.setSkin(i);
    this.paintHeroName(SKIN_DEFS[i]?.n ?? '');
    this.chips.forEach((b, k) => {
      const on = k === i;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.dataset.on = on ? '1' : '0';
    });
    if (reveal) this.chips[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    else this.chips[i]?.focus({ preventScroll: true });

    if (pin) this.holdWhy.pinned = true;
    this.syncHold();
  }

  /** Ad levhasındaki skin adını değiştirir, genişlik ölçümünü bayraklar. */
  private paintHeroName(name: string): void {
    const t = this.root.querySelector('[data-heroname-txt]') as HTMLElement | null;
    if (!t || t.textContent === name) return;
    t.textContent = name;
    this.vitrine.invalidateLabel();
  }

  /** Menüde başka bir şeye tıklanınca/odaklanınca kilidi kaldırır. */
  private releasePin(): void {
    if (!this.holdWhy.pinned) return;
    this.holdWhy.pinned = false;
    this.syncHold();
  }

  /** Ayar paneli: aç/kapat + efekt seçimi utils/settings.ts'e yazar. */
  private openSet(): void {
    this.refreshSet();
    this.setEl.hidden = false;
    // Dışarı tıklayınca kapat (yoksa fare kullanıcısı panelde takılır).
    document.addEventListener('pointerdown', this.onSetOutside, true);
    const cur = this.setEl.querySelector(`[data-fxopt="${fxMode()}"]`) as HTMLElement | null;
    (cur ?? this.setEl.querySelector('[data-setclose]') as HTMLElement).focus({ preventScroll: true });
  }
  private closeSet(): void {
    this.setEl.hidden = true;
    document.removeEventListener('pointerdown', this.onSetOutside, true);
    (this.root.querySelector('[data-gear]') as HTMLElement | null)?.focus({ preventScroll: true });
  }
  private onSetOutside = (e: Event): void => {
    if (this.setEl.hidden) return;
    const t = e.target as HTMLElement | null;
    if (t && !this.setEl.contains(t) && !t.closest?.('[data-gear]')) this.closeSet();
  };
  private refreshSet(): void {
    const m = fxMode();
    this.setEl.querySelectorAll('[data-fxopt]').forEach((b) => {
      (b as HTMLElement).setAttribute('aria-checked', String((b as HTMLElement).dataset.fxopt === m));
    });
    const q = qMode();
    this.setEl.querySelectorAll('[data-q]').forEach((b) => {
      (b as HTMLElement).setAttribute('aria-checked', String((b as HTMLElement).dataset.q === q));
    });
    const f = this.setEl.querySelector('[data-fps]');
    if (f) {
      f.setAttribute('aria-checked', String(fpsOn()));
      const b = f.querySelector('b');
      if (b) b.textContent = fpsOn() ? 'Açık' : 'Kapalı';
    }
  }
  private onSetKey = (e: KeyboardEvent): void => {
    if (this.setEl.hidden) return;
    if (e.key === 'Escape') { this.closeSet(); return; }
    // Odak tuzağı: Tab panel içinde döner, arkaya sızmaz.
    if (e.key !== 'Tab') return;
    const items = [...this.setEl.querySelectorAll<HTMLElement>('button:not([disabled])')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  };

  /** Kilidin son kaynagini vitrine bildirir (herhangi biri -> kilit). */
  private syncHold(): void {
    this.vitrine.setHold(this.holdWhy.hover || this.holdWhy.pinned);
  }

  // ── Olaylar ──────────────────────────────────────────────────────────
  private bind(onStart: (name: string, skin: number) => void): void {
    const go = (): void => {
      const clean = cleanName(this.input.value);
      if (!clean) {
        this.input.focus();
        this.input.select();
        return;
      }
      // Geri bildirim: ad 14 karakteri aşarsa kesmek yerine söyle. Sessiz
      // kırpma kullanıcıya "yazmadı" izlenimi veriyordu (test: 'Test Oyunc').
      if (this.input.value.trim() !== clean && this.input.value.trim().length > NAME_MAX) {
        this.input.value = clean;
      }
      saveName(clean);
      this.stop();
      onStart(clean, this.skin);
    };

    (this.root.querySelector('[data-go]') as HTMLButtonElement).addEventListener('click', go);
    (this.root.querySelector('[data-gear]') as HTMLButtonElement).addEventListener('click', () => this.openSet());
    // İstatistik bloğu Profilim'i açar (meta katmanı dinler; menü bilmez).
    (this.root.querySelector('[data-stats]') as HTMLButtonElement).addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('snakez:profile'));
    });
    (this.root.querySelector('[data-setclose]') as HTMLButtonElement).addEventListener('click', () => this.closeSet());
    this.setEl.querySelectorAll('[data-fxopt]').forEach((b) => {
      (b as HTMLButtonElement).addEventListener('click', () => {
        setFxMode((b as HTMLButtonElement).dataset.fxopt as FxMode);
        this.refreshSet();
      });
    });
    this.setEl.querySelectorAll('[data-q]').forEach((b) => {
      (b as HTMLButtonElement).addEventListener('click', () => {
        setQuality((b as HTMLButtonElement).dataset.q as Quality);
        this.refreshSet();
      });
    });
    (this.setEl.querySelector('[data-fps]') as HTMLButtonElement).addEventListener('click', () => {
      setFpsOn(!fpsOn());
      setFpsMeter(fpsOn());
      this.refreshSet();
    });
    this.root.addEventListener('keydown', this.onSetKey);
    this.input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      go();
    });

    // Game.bindInput() (Game.ts:156) Space'i window seviyesinde yakalayıp
    // preventDefault yapıyor; klavyeyle OYNA çalışmaz hale geliyordu. Menü
    // capture aşamasında devreye girip kendi davranışını veriyor — motora
    // dokunmadan.
    this.root.addEventListener(
      'keydown',
      (e) => {
        if (e.code !== 'Space' || e.repeat) return;
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement !== this.input && !this.setEl.contains(document.activeElement)) {
          (this.root.querySelector('[data-go]') as HTMLButtonElement).click();
        }
      },
      true,
    );

    // Yuva klavyesi: ok/Home/End ile gezinme (WCAG menü deseni).
    const strip = this.root.querySelector('[data-strip]') as HTMLElement;
    strip.addEventListener('keydown', (e) => {
      const k = e.key;
      let next = -1;
      if (k === 'ArrowRight' || k === 'ArrowDown') next = (this.skin + 1) % SKIN_DEFS.length;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') next = (this.skin - 1 + SKIN_DEFS.length) % SKIN_DEFS.length;
      else if (k === 'Home') next = 0;
      else if (k === 'End') next = SKIN_DEFS.length - 1;
      if (next < 0) return;
      e.preventDefault();
      this.selectSkin(next, true);
      this.chips[next].focus({ preventScroll: true });
    });
    // TIKLAMA KAYMASI: tarayıcı `mousedown` -> odak -> "görünür alana
    // getir" zinciri kendiliğinden şeridi kaydırıyordu (ölçülen: scrollLeft
    // 0 -> 265 -> 530). Kullanıcı tıkladığı yuvayı zaten görüyor, bu
    // kaymanın tek işlevi şeridi "kayıp gidiyor" gibi göstermekti.
    // Çözüm: `mousedown`'da varsayılan odaklamayı iptal et, seçimi yap,
    // sonra odak ver. Klavyeyle gezinmede kayma KORUNUR (orada gerekli:
    // ok tuşlarıyla seçim ekran dışına çıkabilir).
    this.chips.forEach((b, i) => {
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        this.selectSkin(i);
        b.focus({ preventScroll: true });
      });
    });

    // ── Kahraman kilidi: skin seçilirken yılan sabitlensin ────────────
    // Sebep: yılan akarken renk önizlemesi takip edilemiyor ("sabit
    // durmuyor", "skin seçimi yılan hareket ediyor"). İKİ kaynak vardır:
    //   1. imleç şeridin üzerindeyken (hover)
    //   2. `pinned` — bir seçim yapıldı ve menüde henüz BAŞKA bir şeye
    //      tıklanmadı/odaklanmadı.
    //
    // 2 numaralı kaynak ESKİDEN 1.6 sn'lik bir zamanlayıcıydı; süre
    // dolunca yılan tam da kullanıcı önizlemeye bakarken kalkıyordu.
    // Artık süre yok: kilidi yalnızca menüdeki başka bir etkileşim kaldırır
    // (aşağıdaki iki dinleyici). Böylece "seçtim, izliyorum" durumunda
    // yılan hiç kalkmaz; kullanıcı adını yazmaya ya da OYNA'ya bastığı anda
    // normal akışına döner.
    //
    // Odak (focus) doğrudan KILIT KAYNAĞI YAPILMADI: kurucuda programatik
    // olarak bir yuvaya odak verildiği için `focusout` hiç tetiklenmez ve
    // yılan sonsuza dek donardı (önceki turda ölçülen hata).
    const skins = this.root.querySelector('.mn-skins') as HTMLElement;
    this.skinsEl = skins;
    skins.addEventListener('pointerenter', () => {
      this.holdWhy.hover = true;
      this.syncHold();
    });
    skins.addEventListener('pointerleave', () => {
      this.holdWhy.hover = false;
      this.syncHold();
    });

    // Pin'i kaldıran iki etkileşim. `capture` kullanılır: şerit DIŞINDAKİ
    // her `pointerdown`/`focusin` için olay, hedefe ulaşmadan önce görür.
    // Şeridin içindekiler elenir — iç tıklama kilidi düşürmez, aksine
    // `selectSkin` onu yeniden kurar. stop()'ta sökülür (sızıntı yapmasın).
    document.addEventListener('pointerdown', this.onDocPin, true);
    document.addEventListener('focusin', this.onDocPin, true);

    window.addEventListener('resize', this.onRs);
  }

  /** Şerit dışındaki etkileşim kilidi düşürür (document dinleyicisi). */
  private onDocPin = (e: Event): void => {
    const t = e.target;
    if (!(t instanceof Node) || !this.skinsEl?.contains(t)) this.releasePin();
  };

  /** Boyut değişiminde önizlemeler tazelenir (window dinleyicisi). */
  private onRs = (): void => {
    this.paintSkins();
    this.vitrine.resize();
    // Şerit satır sayısı değişince bandın yüksekliği de değişir;
    // başlığın konumu yeniden hesaplanmalı. Önce anında, sonra giriş
    // animasyonu durulduğunda temiz ölçüm.
    this.fitCopy();
    this.scheduleFit();
  };

  private stop(): void {
    if (!this.timer) return;
    window.clearInterval(this.timer);
    this.timer = 0;
    window.clearTimeout(this.fitTimer);
    this.ro?.disconnect();
    this.ro = null;
    this.io?.disconnect();
    this.io = null;
    document.removeEventListener('pointerdown', this.onDocPin, true);
    document.removeEventListener('focusin', this.onDocPin, true);
    document.removeEventListener('pointerdown', this.onSetOutside, true);
    window.removeEventListener('resize', this.onRs);
    this.root.removeEventListener('keydown', this.onSetKey);
    for (const off of this.fxOff) off();
    this.fxOff = [];
    this.skinsEl = null;
    this.vitrine.stop();
  }

  // ── Canlı okuma ──────────────────────────────────────────────────────
  private paint(): void {
    const rows = arenaTable(this.game, ROWS);
    this.renderRows(rows);

    // SIRA: menüde oyuncu yok. Kaçıncıdan başlayacağını tahmin etmek uydurma
    // olurdu; dürüst olan arena büyüklüğünü göstermek.
    let alive = 0;
    for (const s of this.game.snakes) if (s.alive) alive++;
    this.rank.textContent = `${alive} yılan`;
  }

  private renderRows(rows: LeaderRow[]): void {
    // ── YENIDEN KURULUM YALNIZCA YAPI DEGISTIGINDE ────────────────────
    // onceki hata: imzaya skor da dahildi. Skor 10sn'de 35 kez degisiyor
    // (≈286ms), yani DOM her poll'da yeniden kuruluyordu. Giris animasyonu
    // 260ms gecikme + 400ms = 660ms oldugu icin HIC BITMIYOR; satirlar
    // surekli `translateX(-10px)`'te takili kaliyordu. Sonuc olculdu:
    //   - vurgu zemini kartin sol kenarindan 1px DISARI tasiyordu
    //   - metin, basliga (LİDERLİK) ve altbilgiye (★ Arenanın) gore 10px
    //     sola kaymisti -> "her sey ice ice girmis".
    // Simdi: yapi (sira/isim) degisirse yeniden kur + animasyon oynat
    // (10sn'de 2 kez, 660ms rahatca biter); skor degisirse YERINDE guncelle.
    const sig = rows.map((r) => `${r.rank}|${r.name}|${r.mine ? 1 : 0}`).join('~');
    if (sig !== this.list.dataset.sig) {
      this.list.dataset.sig = sig;
      this.list.textContent = '';
      for (const r of rows) {
        const li = document.createElement('li');
        li.className = 'mn-row';
        li.dataset.mine = r.mine ? '1' : '0';
        // --i kademeli girişi besler (better-ui: sıralı listede anlamlıdır)
        li.style.setProperty('--i', String(r.rank - 1));
        const rank = document.createElement('em');
        rank.textContent = String(r.rank);
        const name = document.createElement('b');
        name.textContent = r.name;
        const score = document.createElement('span');
        score.textContent = num(r.score);
        li.append(rank, name, score);
        this.list.append(li);
      }
      return;
    }

    // Yapi ayni -> yalnizca skoru yerinde yaz. DOM'a dokunulmaz,
    // animasyon yeniden baslamaz, sira atlama olmaz.
    const kids = this.list.children;
    for (let i = 0; i < rows.length && i < kids.length; i++) {
      const sp = kids[i].querySelector('span');
      const t = num(rows[i].score);
      if (sp && sp.textContent !== t) sp.textContent = t;
    }
  }

  destroy(): void {
    this.stop();
    this.root.textContent = '';
    // body:has(.mn:not([hidden])) seçicisi boş menüde bile eşleşip oyun
    // canvas'ını sonsuza dek soluk tutuyordu. hidden ile kapat.
    this.root.setAttribute('hidden', '');
  }
}

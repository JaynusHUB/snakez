import { BOTS, BOT_GAIN, FC, FOOD_N, FOOD_RATE, WR } from '../utils/Constants.ts';
import { TAU, cellOf, ckey, rnd } from '../utils/MathUtils.ts';
import { Camera } from './Camera.ts';
import { createSnake, resetSnakeIds } from '../entities/Snake.ts';
import type { Snake } from '../entities/Snake.ts';
import { FoodField } from '../entities/Food.ts';
import type { Flying } from '../entities/Food.ts';
import { SnakeGrid } from '../systems/CollisionSystem.ts';
import { moveSnake } from '../systems/MovementSystem.ts';
import { buildDeathPellets } from '../systems/DeathSystem.ts';
import { createBot, findSpawnPos, thinkBot } from '../entities/Bot.ts';
import { drawSnakeBody, pelSprite, skinColorAt } from '../systems/RenderSystem.ts';
import { SPRITE_K, deathFxFor, drawBurst, drawDeathFx, drawDeathSpriteFrame, drawShock, groundAngle, resetDeathBudget } from '../systems/DeathFx.ts';
import { ensureDeathSprite } from '../systems/DeathSprites.ts';
import type { Burst, Shock } from '../systems/DeathFx.ts';
import { skinSpriteId } from '../entities/Skin.ts';
import { fxCalm, qGlow } from '../utils/settings.ts';

/** Oyun akışı: ölüm → kısa slow-mo → otomatik yeniden başlangıç (arayüz yok). */
export type GamePhase = 'playing' | 'dying';

function mkc(w: number, h?: number): HTMLCanvasElement {
  const e = document.createElement('canvas');
  e.width = w;
  e.height = h ?? w;
  return e;
}

export class Game {
  snakes: Snake[] = [];
  me: Snake | null = null;
  flying: Flying[] = [];
  food: FoodField;
  grid = new SnakeGrid();
  cam = new Camera();
  time = 0;
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = 1;
  mx = 0;
  my = 0;
  mouseBoost = false;
  keyBoost = false;
  btnBoost = false;
  watch: Snake | null = null;
  phase: GamePhase = 'playing';
  /** Oyuncu ölünce çağrılır. Atanırsa otomatik replay() devre dışı kalır; yeniden başlatmayı arayüz yapar. */
  onDeath: ((s: Snake, killer: Snake | null) => void) | null = null;

  private timeScale = 1;
  private shake = 0;
  private deathAnchor: { x: number; y: number; r: number } | null = null;
  private botT = 0;
  private hotT = 0;
  private pelAcc = 0;
  private deathTimer = 0;
  private lastSkinIdx = 0;
  private flyingPool: Flying[] = [];
  /** Blue Dragon ölüm şokları (en fazla 8, yaşlanınca süpürülür). */
  private shocks: Shock[] = [];
  /** Blue Dragon toplama parçacıkları (en fazla 160). */
  private bursts: Burst[] = [];
  private ringG: CanvasGradient | null = null;
  private pat: CanvasPattern | string = '#0e1424';
  private mm: HTMLCanvasElement;
  private cv: HTMLCanvasElement;
  private cx: CanvasRenderingContext2D;

  constructor(
    cv: HTMLCanvasElement,
    cx: CanvasRenderingContext2D,
  ) {
    this.cv = cv;
    this.cx = cx;
    resetSnakeIds();
    this.food = new FoodField((c) => pelSprite(c));
    this.mm = mkc(100);
    const mx2 = this.mm.getContext('2d')!;
    mx2.fillStyle = 'rgba(0,0,0,.42)';
    mx2.beginPath();
    mx2.arc(50, 50, 50, 0, TAU);
    mx2.fill();
    mx2.strokeStyle = 'rgba(255,255,255,.25)';
    mx2.lineWidth = 2;
    mx2.beginPath();
    mx2.arc(50, 50, 49, 0, TAU);
    mx2.stroke();
    this.buildPattern();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // Tarayıcı zoom'u ve mobil pinch, CSS penceresini 'resize' ateşlemeden
    // değiştirebilir; görsel pencereyi de dinle. DPR değişimi (monitör
    // geçişi) ayrıca izlenir ki tuval keskinliği güncel kalsın.
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resize());
    }
    this.watchDpr();
    this.bindInput();
    this.food.seedHots(26);
    for (let i = 0; i < FOOD_N; i++) this.food.spawnRegular(0, true);
    for (let i = 0; i < BOTS; i++) this.snakes.push(createBot(this.snakes, true));
  }

  private buildPattern(): void {
    const TW = 240;
    const TH = 416;
    const s = TH / 3;
    const w = TW;
    const e = mkc(TW, TH);
    const x = e.getContext('2d')!;
    x.fillStyle = '#090d17';
    x.fillRect(0, 0, TW, TH);
    const f = 0.93;
    const V = [[0, -s], [w / 2, -s / 2], [w / 2, s / 2], [0, s], [-w / 2, s / 2], [-w / 2, -s / 2]];
    for (let j = -1; j <= 3; j++) {
      for (let i = -1; i <= 2; i++) {
        const px = i * w + (j & 1 ? w / 2 : 0);
        const py = j * 1.5 * s;
        const g = x.createRadialGradient(px, py, 4, px, py, s);
        g.addColorStop(0, '#1a2338');
        g.addColorStop(1, '#111828');
        x.fillStyle = g;
        x.beginPath();
        V.forEach((v, n) => {
          if (n) x.lineTo(px + v[0] * f, py + v[1] * f);
          else x.moveTo(px + v[0] * f, py + v[1] * f);
        });
        x.closePath();
        x.fill();
      }
    }
    try {
      const p = this.cx.createPattern(e, 'repeat');
      if (p) {
        try {
          p.setTransform(new DOMMatrix().scale(80 / TW));
        } catch {
          /* older browser */
        }
        this.pat = p;
      }
    } catch {
      this.pat = '#0e1424';
    }
  }

  resize(): void {
    this.DPR = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.cv.width = Math.max(1, Math.round(this.W * this.DPR));
    this.cv.height = Math.max(1, Math.round(this.H * this.DPR));
  }

  // DPR değişimini izler (monitör geçişi, tarayıcı zoom'u): değişince
  // tuval yeniden ölçülür ve izleyici yeni değere kurulur.
  private watchDpr(): void {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onChange = (): void => {
      mq.removeEventListener('change', onChange);
      this.resize();
      this.watchDpr();
    };
    mq.addEventListener('change', onChange);
  }

  private bindInput(): void {
    window.addEventListener('pointermove', (e) => {
      this.mx = e.clientX;
      this.my = e.clientY;
    });
    window.addEventListener('pointerdown', (e) => {
      this.mx = e.clientX;
      this.my = e.clientY;
      if (e.pointerType === 'mouse' && e.button === 0 && e.target === this.cv) this.mouseBoost = true;
    });
    window.addEventListener('pointerup', () => {
      this.mouseBoost = false;
      this.btnBoost = false;
    });
    window.addEventListener('pointercancel', () => {
      this.mouseBoost = false;
      this.btnBoost = false;
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && (e.target as HTMLElement | null)?.tagName !== 'INPUT') {
        this.keyBoost = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.keyBoost = false;
    });
    window.addEventListener('blur', () => {
      this.mouseBoost = this.keyBoost = this.btnBoost = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    const bb = document.getElementById('bb');
    bb?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.btnBoost = true;
    });
  }

  play(name: string, skin: number): void {
    window.clearTimeout(this.deathTimer);
    // Canlıyken yeniden çağrılırsa eski oyuncu hayalet kalırdı (çarpışan,
    // isimsiz, bot olmayan yetim). Önce onu sessizce sahneden al.
    if (this.me && this.me.alive) {
      this.me.alive = false;
      this.snakes = this.snakes.filter((s) => s !== this.me);
    }
    const pos = findSpawnPos(this.snakes);
    const s = createSnake(name, skin, false, 10, pos.x, pos.y, Math.random() * TAU);
    this.me = s;
    this.snakes.push(s);
    this.cam.snap(s.x, s.y);
    this.mx = this.W / 2 + Math.cos(s.ang) * 100;
    this.my = this.H / 2 + Math.sin(s.ang) * 100;
    this.lastSkinIdx = skin;
    // state reset — yeniden başlangıç sayfa reload'u gerektirmez
    this.phase = 'playing';
    this.timeScale = 1;
    this.shake = 0;
    this.deathAnchor = null;
  }

  replay(): void {
    this.play('Oyuncu', this.lastSkinIdx);
  }

  private kill(s: Snake, killerId: number): void {
    if (!s.alive) return;
    s.alive = false;
    const killer = killerId ? this.snakes.find((o) => o.id === killerId) ?? null : null;
    // Eleme sayacı yalnızca hayatta kalana: kafa-kafa çiftinde ölen taraf
    // kredi almaz, duvar-ölüsü katil sayılmaz.
    if (killer && killer.alive) killer.kills++;
    const pellets = buildDeathPellets(s);
    // Ölüm yemi efekti: ÖLENİN skininden türetilir (8 özel skin).
    // Herkesin efekti görünür (botların kendi aralarındaki ölümleri
    // dahil); normal skinler klasik yem döker. Kütle/değer/sayı aynı.
    const me = this.me;
    const fx = deathFxFor(skinSpriteId(s.skin));
    for (const p of pellets) this.food.addPellet(p.x, p.y, p.v, p.c, p.delay, this.time, false, fx, s.x, s.y);
    if (fx) {
      // Lazy sprite: takılı skinin dokusu arka planda yüklenir; gelene
      // kadar düz yem çizilir (oyun bozulmaz).
      void ensureDeathSprite(fx);
      // Ölüm şoku: kısa halka + çarpma parlaması (yalnızca görsel; sayaç yok).
      if (this.shocks.length >= 8) this.shocks.shift();
      this.shocks.push({ x: s.x, y: s.y, t0: this.time });
      // Hafif sarsıntı: yalnızca beni ilgilendiren ölümlerde (ben öldüm /
      // ben eledim); uzak bot-bot ölümleri kamerayı titretmez. Sakin modda
      // render zaten sarsıntıyı sıfırlar (Efektler=Kapalı veya reduced-motion kapatır).
      if (me && (s === me || killer === me) && !fxCalm()) this.shake = Math.min(this.shake + 6, 12);
    }
    if (s === this.me) {
      // impact + slow-mo + shake, ardından otomatik yeniden başlangıç
      this.phase = 'dying';
      this.timeScale = 0.12;
      this.shake = 16;
      this.deathAnchor = { x: s.x, y: s.y, r: s.r };
      window.clearTimeout(this.deathTimer);
      if (this.onDeath) {
        const cb = this.onDeath;
        this.deathTimer = window.setTimeout(() => cb(s, killer), 900);
      } else {
        this.deathTimer = window.setTimeout(() => {
          this.replay();
        }, 1500);
      }
    }
  }

  private collisions(): void {
    const dead: Array<[Snake, number]> = [];
    const wallDead = new Set<number>();
    for (const s of this.snakes) {
      if (!s.alive) continue;
      if (s.x * s.x + s.y * s.y > WR * WR) {
        dead.push([s, 0]);
        wallDead.add(s.id);
      }
    }
    // Kafa-kafa: çift başına tam bir ölen; kazanan o karede gövdeye ölmez.
    const pairLosers = this.grid.resolvePairs(this.snakes, wallDead);
    const immune = new Set<number>(pairLosers.values());
    for (const s of this.snakes) {
      if (!s.alive || wallDead.has(s.id)) continue;
      if (pairLosers.has(s.id)) {
        dead.push([s, pairLosers.get(s.id)!]);
        continue;
      }
      if (immune.has(s.id)) continue;
      const killer = this.grid.headHit(s, wallDead);
      if (killer) dead.push([s, killer]);
    }
    for (const d of dead) this.kill(d[0], d[1]);
  }

  private eatFood(): void {
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const pr = s.r * 2.3 + 22;
      const pr2 = pr * pr;
      const ix0 = cellOf(s.x - pr, FC);
      const ix1 = cellOf(s.x + pr, FC);
      const iy0 = cellOf(s.y - pr, FC);
      const iy1 = cellOf(s.y + pr, FC);
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iy = iy0; iy <= iy1; iy++) {
          const key = ckey(ix, iy);
          const a = this.food.cells.get(key);
          if (!a) continue;
          for (let i = a.length - 1; i >= 0; i--) {
            const p = a[i];
            if (this.time < p.born) continue;
            const dx = p.x - s.x;
            const dy = p.y - s.y;
            if (dx * dx + dy * dy < pr2) {
              a[i] = a[a.length - 1];
              a.pop();
              this.food.count--;
              if (p.reg) this.food.regular--;
              p.dead = true;
              if (p.fx && !fxCalm()) {
                // Toplama patlaması: tema renginde küçük parçacıklar (değer/kütle aynı).
                const n = qGlow() <= 0 ? 1 : qGlow() < 1 ? 2 : 3;
                for (let k = 0; k < n && this.bursts.length < 160; k++) {
                  this.bursts.push({ x: p.x, y: p.y, vx: rnd(-46, 46), vy: rnd(-110, -30), t0: this.time, life: rnd(0.35, 0.6), sd: Math.random(), fx: p.fx });
                }
              }
              const f = this.flyingPool.pop() ?? { x: 0, y: 0, sx: 0, sy: 0, t: 0, v: 0, r: 0, spr: p.spr, s, fx: 0, rot: 0 };
              f.x = p.x; f.y = p.y; f.sx = p.x; f.sy = p.y;
              f.t = 0; f.v = p.v; f.r = p.r; f.spr = p.spr; f.s = s; f.fx = p.fx; f.rot = groundAngle(p.ph);
              this.flying.push(f);
            }
          }
          if (a.length === 0) this.food.cells.delete(key);
        }
      }
    }
  }

  private releaseFlying(idx: number): void {
    const last = this.flying.length - 1;
    const f = this.flying[idx];
    this.flying[idx] = this.flying[last];
    this.flying.pop();
    if (this.flyingPool.length < 256) this.flyingPool.push(f);
  }

  private updateFlying(dt: number): void {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      const s = f.s;
      if (!s.alive) {
        this.releaseFlying(i);
        continue;
      }
      f.t += dt / 0.16;
      if (f.t >= 1) {
        s.mass += f.v * (s.bot ? BOT_GAIN : 1);
        this.releaseFlying(i);
        continue;
      }
      const e = f.t * f.t;
      f.x = f.sx + (s.x - f.sx) * e;
      f.y = f.sy + (s.y - f.sy) * e;
    }
  }

  /** Blue Dragon şok/parçacık yaşlandırma: süresi dolanı listeden at. */
  private updateBursts(): void {
    if (this.shocks.length > 0) this.shocks = this.shocks.filter((sh) => this.time - sh.t0 < 0.6);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      if (this.time - this.bursts[i].t0 >= this.bursts[i].life) {
        this.bursts[i] = this.bursts[this.bursts.length - 1];
        this.bursts.pop();
      }
    }
  }

  update(dt: number): void {
    // DYING: dünya slow-mo (yalnızca bu pencerede, gameplay formülleri aynı)
    if (this.phase === 'dying') {
      this.timeScale += (0.12 - this.timeScale) * Math.min(1, dt * 12);
    } else {
      this.timeScale = 1;
    }
    dt *= this.timeScale;
    this.time += dt;
    if (this.me && this.me.alive) {
      this.me.wang = Math.atan2(this.my - this.H / 2, this.mx - this.W / 2);
      this.me.boost = this.mouseBoost || this.keyBoost || this.btnBoost;
    }
    for (const s of this.snakes) {
      if (s.bot && s.alive) {
        s.think -= dt;
        if (s.think <= 0) {
          s.think = 0.1 + Math.random() * 0.06;
          thinkBot(s, this.snakes, this.food, this.food.hots, this.time, this.grid);
        }
      }
    }
    const n = Math.max(1, Math.ceil(dt * 60 - 1e-6));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      for (const s of this.snakes) {
        if (!s.alive) continue;
        moveSnake(
          s,
          h,
          (x, y, v, c) => this.food.addPellet(x, y, v, c, 0, this.time),
          (bi) => skinColorAt(s.skin, bi),
        );
      }
    }
    this.grid.build(this.snakes);
    this.collisions();
    this.eatFood();
    this.updateFlying(dt);
    this.updateBursts();
    this.snakes = this.snakes.filter((s) => s.alive);
    this.botT -= dt;
    if (this.botT <= 0) {
      this.botT = 0.8;
      let c = 0;
      for (const s of this.snakes) if (s.bot) c++;
      if (c < BOTS) this.snakes.push(createBot(this.snakes, false));
    }
    this.hotT -= dt;
    if (this.hotT <= 0) {
      this.hotT = 15;
      if (this.food.hots.length > 0) {
        this.food.hots[(Math.random() * this.food.hots.length) | 0] = this.food.newHot();
      }
    }
    this.pelAcc = Math.min(this.pelAcc + dt * FOOD_RATE, 30);
    while (this.food.regular < FOOD_N && this.pelAcc >= 1) {
      this.pelAcc--;
      this.food.spawnRegular(this.time, false);
    }
  }

  render(dt: number): void {
    const cx = this.cx;
    let p = this.me && this.me.alive ? this.me : null;
    if (!p && this.deathAnchor) p = this.deathAnchor as unknown as Snake;
    if (!p) {
      if (!this.watch || !this.watch.alive) this.watch = this.snakes.find((s) => s.alive && s.bot) ?? null;
      p = this.watch;
    }
    const px = p ? p.x : 0;
    const py = p ? p.y : 0;
    const pr = p ? p.r : 10;
    this.cam.update(dt, px, py, pr, this.W, this.H, !!(this.me && this.me.alive));
    const z = this.cam.z;
    const W = this.W;
    const H = this.H;
    const DPR = this.DPR;
    // ekran sarsıntısı — yalnızca DYING penceresinde, transform ile (repaint yok)
    this.shake *= Math.pow(0.0008, dt);
    if (this.shake < 0.15) this.shake = 0;
    const reduced = fxCalm();
    const ox = reduced ? 0 : (Math.random() - 0.5) * this.shake;
    const oy = reduced ? 0 : (Math.random() - 0.5) * this.shake;
    cx.setTransform(DPR, 0, 0, DPR, ox * DPR, oy * DPR);
    cx.fillStyle = '#04060c';
    cx.fillRect(-W, -H, W * 3, H * 3);
    cx.setTransform(DPR * z, 0, 0, DPR * z, (W / 2 - this.cam.x * z) * DPR + ox * DPR, (H / 2 - this.cam.y * z) * DPR + oy * DPR);
    cx.fillStyle = this.pat;
    cx.beginPath();
    cx.arc(0, 0, WR, 0, TAU);
    cx.fill();
    if (!this.ringG) {
      const g = cx.createRadialGradient(0, 0, WR - 320, 0, 0, WR);
      g.addColorStop(0, 'rgba(200,30,40,0)');
      g.addColorStop(1, 'rgba(220,40,50,.38)');
      this.ringG = g;
    }
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 3);
    cx.fillStyle = this.ringG;
    cx.globalAlpha = pulse;
    cx.beginPath();
    cx.arc(0, 0, WR, 0, TAU);
    cx.fill();
    cx.globalAlpha = 1;
    cx.strokeStyle = 'rgba(255,70,80,.85)';
    cx.lineWidth = 8;
    cx.beginPath();
    cx.arc(0, 0, WR + 4, 0, TAU);
    cx.stroke();
    cx.strokeStyle = 'rgba(120,10,25,.55)';
    cx.lineWidth = 140;
    cx.beginPath();
    cx.arc(0, 0, WR + 78, 0, TAU);
    cx.stroke();
    const vx0 = this.cam.x - W / 2 / z - 40;
    const vx1 = this.cam.x + W / 2 / z + 40;
    const vy0 = this.cam.y - H / 2 / z - 40;
    const vy1 = this.cam.y + H / 2 / z + 40;
    const ix0 = cellOf(vx0, FC);
    const ix1 = cellOf(vx1, FC);
    const iy0 = cellOf(vy0, FC);
    const iy1 = cellOf(vy1, FC);
    resetDeathBudget();
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        const a = this.food.cells.get(ckey(ix, iy));
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const f = a[i];
          if (f.x < vx0 || f.x > vx1 || f.y < vy0 || f.y > vy1) continue;
          const age = this.time - f.born;
          if (age < 0) continue;
          const sc = age < 0.3 ? age / 0.3 : 1;
          const q = f.r * 5.6 * (1 + 0.09 * Math.sin(this.time * 3.2 + f.ph)) * sc;
          // Efektli yem sprite'la çizilir; sprite yoksa/yüklenemediyse düz yem.
          if (!f.fx || !drawDeathFx(cx, f, f.r, this.time, this.DPR * z)) {
            cx.drawImage(f.spr, f.x - q / 2, f.y - q / 2, q, q);
          }
        }
      }
    }
    if (!reduced) {
      // Ölüm şokları + toplama parçacıkları (dünya uzayı).
      for (const sh of this.shocks) drawShock(cx, sh.x, sh.y, z, this.time - sh.t0);
      for (const b of this.bursts) drawBurst(cx, b, this.time - b.t0);
    }
    for (const f of this.flying) {
      const q = f.r * 5.6 * (1 - 0.45 * f.t);
      const E = f.r * SPRITE_K;
      if (!f.fx || !drawDeathSpriteFrame(cx, f.fx, f.x, f.y, E, f.rot, this.DPR * z)) {
        cx.drawImage(f.spr, f.x - q / 2, f.y - q / 2, q, q);
      }
    }
    for (const s of this.snakes) {
      if (s.alive && s !== this.me) drawSnakeBody(cx, s, z, vx0, vx1, vy0, vy1);
    }
    if (this.me && this.me.alive) drawSnakeBody(cx, this.me, z, vx0, vx1, vy0, vy1);
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (this.me && this.me.alive) {
      const mxp = W - 68;
      const myp = H - 68;
      cx.drawImage(this.mm, mxp - 46, myp - 46, 92, 92);
      cx.fillStyle = 'rgba(255,255,255,.35)';
      for (const s of this.snakes) {
        if (s === this.me || !s.alive) continue;
        cx.fillRect(mxp + (s.x / WR) * 44 - 1, myp + (s.y / WR) * 44 - 1, 2, 2);
      }
      cx.fillStyle = '#ffd84a';
      cx.beginPath();
      cx.arc(mxp + (this.me.x / WR) * 44, myp + (this.me.y / WR) * 44, 3, 0, TAU);
      cx.fill();
    }
  }

  snapshot(): string {
    const payload = {
      mode: this.me && this.me.alive ? 'play' : 'idle',
      time: Math.round(this.time * 100) / 100,
      player: this.me && this.me.alive
        ? { x: Math.round(this.me.x), y: Math.round(this.me.y), r: Math.round(this.me.r * 10) / 10, mass: Math.floor(this.me.mass) }
        : null,
      snakes: this.snakes.filter((s) => s.alive).slice(0, 12).map((s) => ({ n: s.name, x: Math.round(s.x), y: Math.round(s.y), m: Math.floor(s.mass) })),
      food: this.food.count,
      score: this.me ? Math.floor(this.me.mass) : 0,
      origin: 'center 0,0 world coords, +x right +y down',
    };
    return JSON.stringify(payload);
  }
}

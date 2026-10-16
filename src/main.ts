// Giriş noktası — kabuk katmanı. Menüyü kurar, arenayı canlı tutar ve
// oyuncu OYNA'ya bastığında oyunu başlatır.
//
// Sıra önemli:
//   1. Game kurulur, GameLoop başlar. `game.play()` ÇAĞRILMAZ, bu yüzden
//      `game.me` null kalır ve Game.render() kendi `this.watch` yoluna düşer
//      (Game.ts:358) — menünün arkasındaki arena motorun kendi döngüsüdür.
//      Menü için ikinci canvas, ikinci rAF veya özel çizim katmanı yoktur.
//   2. Menü bu izleyici arenanın üstüne kurulur.
//   3. OYNA -> Menu.onStart -> game.play(name, skin); menü kapanır.
//
// core/, entities/, systems/, utils/ içinde değişen tek şey yoktur.
import './style.css';
import { Game } from './core/Game.ts';
import { GameLoop } from './core/GameLoop.ts';
import { initFx } from './utils/settings.ts';
import { initFpsMeter } from './utils/fps.ts';
import { Menu } from './menu/menu.ts';
import { RunLog } from './menu/runlog.ts';
import { commitRun } from './menu/storage.ts';
import { Meta } from './meta/meta.ts';
import { preloadSkinSprites } from './systems/SpriteSkins.ts';

// ── Arena ────────────────────────────────────────────────────────────────
initFx();
initFpsMeter();

const cv = document.getElementById('g') as HTMLCanvasElement;
const cx = cv.getContext('2d', { alpha: false })!;

const game = new Game(cv, cx);
const loop = new GameLoop(
  (dt) => game.update(dt),
  (dt) => game.render(dt),
);
loop.start();

// ── Menü ─────────────────────────────────────────────────────────────────
const host = document.getElementById('menu') as HTMLElement;
const boost = document.getElementById('bb');

const menu = new Menu(host, game, (name, skin) => {
  menu.destroy();
  boost?.removeAttribute('hidden');
  game.play(name, skin);
  runlog.reset();
  // Alan dışına bırak: Space artık menü yakalayıcısına değil oyuna gitsin.
  (document.activeElement as HTMLElement | null)?.blur?.();
});

preloadSkinSprites().then(() => menu.paintSkins());

// ── Tur istatistiği ──────────────────────────────────────────────────────
// Oyuncu OYNA'ya bastıktan sonra devreye girer. Oyun sırasında 4 Hz örneklenir:
// ölüm motorun kendi replay()'ini çağırır, menü yalnızca o ölümü GÖZLEMLER
// ve skoru depolar. Skor = snake.mass; motorun Game.snapshot()'ta kullandığı
// tanımın aynısı, yani burada uydurma bir ölçüt yok.
const runlog = new RunLog((score) => {
  commitRun(score);
});
runlog.reset();

const poll = window.setInterval(() => {
  runlog.sample(game);
}, 250);

// Sekme gizlenirken örnekleme durur: arka planda sayaç işletmenin anlamı yok
// ve uyanınca ilk örnek yanlış "ölüm" sanabilir. Sıfırlama YALNIZCA oyuncu
// CANLIYKEN yapılır (denetim B2): ölüm penceresinde bekleyen tur korunur ki
// sekme değiştirip TEKRAR OYNA seçen oyuncunun turu OYUN/REKOR'a işlenebilsin.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.me?.alive) runlog.reset();
});

// ── Test kancaları (yalnızca geliştirme) ─────────────────────────────────
// Oyun mantığına dokunmaz ve oyun akışında hiçbiri kullanılmaz. Üretim
// derlemesinde pencereye HİÇ bağlanmaz (denetim B1): konsoldan motor
// manipülasyon yüzeyi yalnızca DEV sunucusunda açıktır.
// ── Meta: XP/seviye, liderlik, ölüm ekranı, market ───────────────────────
new Meta(game);

const w = window as unknown as {
  render_game_to_text?: () => string;
  advanceTime?: (ms: number) => void;
  __menu?: Menu;
  __poll?: number;
};
if (import.meta.env.DEV) {
  w.render_game_to_text = () => game.snapshot();
  w.advanceTime = (ms) => loop.advanceTime(ms);
  w.__menu = menu;
  w.__poll = poll;
}

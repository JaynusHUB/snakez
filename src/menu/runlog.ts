// Tur istatistiği — REKOR ve OYUN sayacını besler.
//
// Neden ayrı dosya: menü oyuna girildiğinde yok edilir; ama istatistik
// oyun SIRASINDA toplanmak zorunda. Bu yüzden kayıt menünün değil, kabuk
// katmanının (main.ts) işidir. Menü yalnızca sonucu gösterir.
//
// Motor dokunulmaz. `Game.kill()` ölümden 1500 ms sonra `replay()` çağırır;
// menü onu engelleyemez ve ölmeye çalışmaz. Bu yüzden ölüm TAHMİN EDİLMEZ,
// GÖZLENİR. Skor = `snake.mass`; motorun `Game.snapshot()` içinde kullandığı
// tanımın aynısı (bkz. `score: Math.floor(this.me.mass)`).
//
// Ölüm algısı: `game.me` referansı değişmesi. Motor her `play()` çağrısında
// `createSnake` ile YENİ bir Snake üretip `this.me`'yi ona bağlar
// (Game.ts:179-180), yani ölümden sonraki otomatik doğuş yeni bir kimlik
// demektir. `alive` bayrağına bakmak YANLIŞTIR: `kill()` ölü yılanı
// listeden filtreleyip siler ama `this.me` hâlâ o nesneyi gösterir, bu yüzden
// bayrak 1500 ms boyunca `false` kalır ve her örneklemde yeniden sayılır.
// Kimlik değişimi bu tuzağı içermez.
import type { Game } from '../core/Game.ts';
import type { Snake } from '../entities/Snake.ts';

export class RunLog {
  private current: Snake | null = null;
  private peak = 0;
  private last: (score: number) => void;

  constructor(last: (score: number) => void) {
    this.last = last;
  }

  /** Oyun döngüsünden bağımsız, 4 Hz'de çağrılmalı. */
  sample(game: Game): void {
    const me = game.me;

    if (!me || !me.alive) {
      // Menüdeyken veya ölüm penceresindeyken: yalnızca tepe değeri tut.
      // Sayım, kimlik değişiminde yapılır.
      if (me && me.alive === false && this.current === me) this.peak = Math.max(this.peak, Math.floor(me.mass));
      return;
    }

    if (me !== this.current) {
      // Yeni hayat. Önceki bittiyse skoru kaydet.
      if (this.current && this.peak > 0) this.last(this.peak);
      this.current = me;
      this.peak = 0;
    }

    if (me.mass > this.peak) this.peak = Math.floor(me.mass);
  }

  /** Sekme gizlenirken veya menüye dönüşte çağrılır: yarım kalan tur
   *  istatistiğe yazılmaz, yoksa kapatılan sekme sahte rekor üretir. */
  reset(): void {
    this.current = null;
    this.peak = 0;
  }
}

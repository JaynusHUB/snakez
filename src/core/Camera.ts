import { clamp } from '../utils/MathUtils.ts';

export class Camera {
  x = 0;
  y = 0;
  z = 1;

  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  update(dt: number, px: number, py: number, pr: number, W: number, H: number, alive: boolean): void {
    const kk = 1 - Math.exp(-dt * (alive ? 12 : 5));
    this.x += (px - this.x) * kk;
    this.y += (py - this.y) * kk;
    let zt = (Math.sqrt(W * H) / 900) * Math.pow(9.6 / pr, 0.5);
    // Adil görüş: 16:9'dan daha geniş ekranlar (ultra-wide, zoom-out ile
    // büyüyen alan) aynı yılan boyunda daha fazla dünya görmesin. Referans
    // 1920x1080 @%100: görünen genişlik, referans ekranın görüşüne sabitlenir
    // (sahne daha büyük çizilir, daha fazlası değil). Dar ekranlar ve yılan
    // büyüdükçe küçülen zoom aynen korunur.
    const refAspect = 1920 / 1080;
    const aspect = H > 0 ? W / H : refAspect;
    if (aspect > refAspect) zt *= Math.sqrt(aspect / refAspect);
    // Tavan, adil-görüş tabanını ezmesin: dev ekranlarda gereken yakınlaşma
    // (zt > 3) aynen uygulanır; normal aralıkta eski 3.0 tavan korunur
    // (küçük ekranlar ve küçük yılanlardaki davranış değişmez).
    this.z += (clamp(zt, 0.22, Math.max(3, zt)) - this.z) * (1 - Math.exp(-dt * 2.5));
  }
}

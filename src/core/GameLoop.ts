export class GameLoop {
  private raf = 0;
  private last = 0;
  private onUpdate: (dt: number) => void;
  private onRender: (dt: number) => void;

  constructor(
    onUpdate: (dt: number) => void,
    onRender: (dt: number) => void,
  ) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  start(): void {
    if (this.raf) return; // çift başlatmayı engelle
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.last = performance.now();
    });
    const frame = (t: number): void => {
      let dt = (t - this.last) / 1000;
      this.last = t;
      if (!(dt > 0)) dt = 1 / 60;
      dt = Math.min(dt, 0.04);
      this.onUpdate(dt);
      this.onRender(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  advanceTime(ms: number): void {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) {
      this.onUpdate(1 / 60);
    }
    this.onRender(1 / 60);
  }
}

export interface Snake {
  id: number;
  name: string;
  skin: number;
  bot: boolean;
  alive: boolean;
  x: number;
  y: number;
  ang: number;
  wang: number;
  mass: number;
  r: number;
  dlen: number;
  spd: number;
  boost: boolean;
  boosting: boolean;
  fx: number;
  drainAcc: number;
  kills: number;
  sp: number;
  tx: number[];
  ty: number[];
  ts: number;
  body: Float32Array;
  bn: number;
  think: number;
  wander: number;
  tf: { x: number; y: number; dead: boolean; v: number } | null;
  tfT: number;
  hot: { x: number; y: number; r: number } | null;
  aggr: boolean;
  caution: number;
}

let nextId = 1;

export function resetSnakeIds(): void {
  nextId = 1;
}

export function createSnake(
  name: string,
  skinIdx: number,
  bot: boolean,
  mass: number,
  x: number,
  y: number,
  ang: number,
): Snake {
  const r0 = 9 + 6 * Math.log10(1 + mass / 40);
  const len0 = 55 + 10.5 * Math.pow(mass, 0.7);
  const s: Snake = {
    id: nextId++,
    name,
    skin: skinIdx,
    bot,
    alive: true,
    x,
    y,
    ang,
    wang: ang,
    mass,
    r: r0,
    dlen: len0,
    spd: 185,
    boost: false,
    boosting: false,
    fx: 0,
    drainAcc: 0,
    kills: 0,
    sp: 0,
    tx: [],
    ty: [],
    ts: 0,
    body: new Float32Array(128),
    bn: 0,
    think: Math.random() * 0.1,
    wander: ang,
    tf: null,
    tfT: 0,
    hot: null,
    aggr: Math.random() < 0.55,
    caution: 0.85 + Math.random() * 0.4,
  };
  const back = s.dlen + 60;
  for (let d = back; d > 0; d -= 3) {
    s.tx.push(x - Math.cos(ang) * d);
    s.ty.push(y - Math.sin(ang) * d);
  }
  s.tx.push(x);
  s.ty.push(y);
  buildBody(s);
  return s;
}

export function buildBody(s: Snake): void {
  // 0.34 = segment aralık çarpanı (sp = r × 0.34). Önceden Constants.SPC
  // olarak duruyordu ama hiç import edilmediği için ölü export'du; sabit
  // yerine sabit değer burada yaşıyor.
  const sp = s.r * 0.34;
  s.sp = sp;
  const nMax = Math.floor(s.dlen / sp);
  if (s.body.length < (nMax + 2) * 2) s.body = new Float32Array((nMax + 16) * 2);
  const b = s.body;
  const tx = s.tx;
  const ty = s.ty;
  let n = 0;
  let px = s.x;
  let py = s.y;
  let acc = 0;
  let i = tx.length - 1;
  outer: for (; i >= s.ts; i--) {
    const qx = tx[i];
    const qy = ty[i];
    let dx = qx - px;
    let dy = qy - py;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) continue;
    while (acc + d >= sp) {
      const t = (sp - acc) / d;
      px += dx * t;
      py += dy * t;
      b[n * 2] = px;
      b[n * 2 + 1] = py;
      n++;
      if (n >= nMax) break outer;
      dx = qx - px;
      dy = qy - py;
      d = Math.sqrt(dx * dx + dy * dy);
      acc = 0;
    }
    acc += d;
    px = qx;
    py = qy;
  }
  s.bn = n;
  const keep = Math.max(s.ts, i - 8);
  s.ts = keep;
  if (s.ts > 300) {
    s.tx.splice(0, s.ts);
    s.ty.splice(0, s.ts);
    s.ts = 0;
  }
}

export function taperRatio(s: Snake, i: number): number {
  return 0.55 + 0.45 * Math.min(1, (s.dlen - (i + 1) * s.sp) / (6 * s.sp));
}

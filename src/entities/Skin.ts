// Skin = oyun içi görsel içerik (botlar dahil her yılanın rengi).
// Özel skin / localStorage kişiselleştirmesi yok — yalnızca yerleşik tanımlar.
import { SKIN_DEFS } from '../utils/Constants.ts';
import { skinIndex } from '../utils/MathUtils.ts';

export interface SkinView {
  n: string;
  c: string[];
  b: number;
  sprite?: string;
}

export function skinCount(): number {
  return SKIN_DEFS.length;
}

function getSkinDef(idx: number): SkinView {
  const d = SKIN_DEFS[idx] ?? SKIN_DEFS[0];
  return { n: d.n, c: d.c, b: d.b, sprite: d.sprite };
}

export function skinColorAt(skinIdx: number, bodyIndex: number): string {
  const def = getSkinDef(skinIdx);
  return def.c[skinIndex(def.c.length, def.b, bodyIndex)] ?? def.c[0];
}

export function skinSpriteId(skinIdx: number): string | undefined {
  return getSkinDef(skinIdx).sprite;
}

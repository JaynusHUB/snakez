// Marka renkleri — TEK doğruluk kaynağı.
//
// Sorun: `menu.css` :root içinde `--p-brand-1..3` tanımlıyor, vitrine ise
// aynı üç değeri kendi dizisinde TEKRARLAMIYORDU. design-system'in
// `validate-tokens.cjs` scripti bunu yakaladı (vitrine.ts:15 hardcoded hex).
// Sonuç: CSS'te markayı değiştirmek vitrine'ı etkilemezdi — iki kaynak,
// sessizce ayrışırlardı.
//
// Çözüm: renkler runtime'da CSS değişkenlerinden okunur. Böylece:
//   - kaynak tek (`:root`)
//   - tema/palette değişikliği vitrine'a da yansır
//   - vitrine.ts içinde hardcoded hex kalmaz
//
// Canvas, CSS değişkenini doğrudan kullanamaz; `getComputedStyle` ile
// çözülmüş değer alınır. Okuma bir kez yapılır (marka sabit), sonra
// vitrine her karede diziyi kullanır — getComputedStyle kare başına
// çağrılmaz, bu yüzden maliyet sıfır.
const VAR = ['--p-brand-1', '--p-brand-2', '--p-brand-3', '--p-beat'] as const;

let cached: string[] | null = null;

/** Marka gradyanının üç durağı + amblem içi. `:root`'tan okunur.
 *  4. değer (`--p-beat`) amblemin göz bebeği boşluğu.
 *
 *  CSS henüz yüklenmediyse boş dizi yerine sabit varsayılan döner:
 *  boş renk `glowSprite('')` içinde addColorStop'ta SyntaxError atıyordu. */
export function brand(): readonly string[] {
  if (cached) return cached;
  const FALLBACK = ['#9d5cff', '#2be7ff', '#a8ff3e', '#070a12'];
  try {
    const cs = getComputedStyle(document.documentElement);
    const got = VAR.map((v) => cs.getPropertyValue(v).trim());
    cached = got.map((g, i) => (g ? g : FALLBACK[i]));
  } catch {
    cached = FALLBACK;
  }
  return cached;
}


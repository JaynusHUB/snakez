# Snakez 🐍

Tarayıcıda çalışan 2D yılan arenası — **büyü, sıralamaya tırman.**

*Snakez is a browser-based snake arena game built with vanilla TypeScript + Canvas 2D.*

▶️ **Canlı oyun:** [Oyna](VERCEL_LINKI)

Yem toplayıp yılanını büyüt, bot rakipleri alt et; öldüğünde bıraktığın yemler arenada iz bırakır. Framework kullanılmaz (vanilla TypeScript + sade CSS); oyunun tamamı istemci tarafında çalışır. Supabase yalnızca **opsiyonel** Google girişi ve bulut kayıt için kullanılır — yapılandırılmasa bile oyun uçtan uca çalışır.

---

## Özellikler

- 🎮 Canvas 2D oyun döngüsü — sabit adımlı simülasyon, FPS ölçümü ve kalite ayarı
- 🤖 Bot rakipler, büyüme mekaniği, kafa-kafa çarpışması ve ölüm efektleri
- 🎨 Market: yılan derileri (premium dahil), sandık ödülleri, kariyer ve başarımlar
- 💀 Ölüm yemleri — ölen yılanlar skin'ine göre özel sprite bırakır (8 tema, WebP)
- 👤 Google ile giriş + bulut kayıt senkronu (opsiyonel; env boşsa tamamen yerel çalışır)
- 📱 Mobil dokunmatik kontrol (HIZLAN düğmesi) ve responsive menü
- 🇹🇷 Türkçe arayüz + gizlilik politikası sayfası (`gizlilik.html`)

## Teknolojiler

| Katman | Teknoloji |
| --- | --- |
| Dil | TypeScript ~6.0 (strict) — framework yok, sade CSS |
| Dev sunucu / build | Vite 8 (Rolldown tabanlı) |
| Render | Canvas 2D |
| Arka uç (opsiyonel) | Supabase — auth + profil/bulut kayıt |
| Fontlar | @fontsource — Chakra Petch, Exo 2 |
| Doğrulama | Playwright (Chromium) |

## Gereksinimler

- **Node.js 22+** (geliştirme ve testler Node 22.23.2 ile yapıldı)
- npm 10+
- Doğrulama scriptleri için Chromium: `npx playwright install chromium`

## Kurulum

```bash
npm install
cp .env.example .env.local       # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev                      # http://localhost:5173
```

### Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase proje URL'i |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) anahtarı |

- Değerler **boş bırakılırsa oyun misafir modda çalışır**; giriş ve bulut kayıt kapalı kalır, oyunun geri kalanı eksiksiz çalışır.
- Anon anahtar gizli değildir — istemciye gömülür (tasarım gereği). Güvenlik Supabase tarafındaki **RLS** politikalarıyla sağlanır. `service_role` anahtarını asla `.env` dosyalarına ya da repoya koymayın.
- `.env*` dosyaları `.gitignore`'dadır; yalnızca `.env.example` takip edilir.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (http://localhost:5173) |
| `npm run build` | Tip kontrolü (`tsc`) + üretim derlemesi (`dist/`) |
| `npm run preview` | `dist/` çıktısını yerel olarak servis eder |

## Doğrulama (Playwright)

> Önce `npm run dev` ile **5173 portunda dev sunucusu açık olmalı.** Oyun içi test kancaları (`render_game_to_text`, `advanceTime`, `__menu`, `__poll`) yalnızca geliştirme modunda tanımlıdır; üretim derlemesinde yer almaz.

```bash
npm run verify                                # Çekirdek döngü: tüm senaryolar (desktop + mobil)
npm run verify:ui                             # Aynısı, görünür pencerede
node scripts/verify.mjs --only menu           # Tek senaryo çalıştır
URL=http://localhost:4173 node scripts/verify.mjs   # Farklı port hedefle
```

Senaryo doğrulamaları (aynı ön koşulla çalışır):

| Script | Kapsam |
| --- | --- |
| `npm run verify:menu` | Menü akışları (isim, kayıt, butonlar) |
| `npm run verify:brand` | Logo ve üst bandın sade denetimi (hover/dokunmatik/hareket azaltma'da değişmemeli) |
| `npm run verify:contrast` | Renk kontrastı |
| `npm run verify:view` | Kamera zoom formülünün ekran boyutundan bağımsızlığı |
| `npm run verify:food` | Yem ekonomisi (harita büyüklüğü, zemin stoğu yoğunluğu, doğuş doldurma) |
| `npm run verify:clash` | Kafa-kafa çarpışması (her koşulda taraflardan tam biri ölür) |
| `npm run verify:deathfx` | Ölüm yemi efektleri (skin→tema, değer korunumu, FPS, düşük kalite) |
| `npm run verify:deathfood` | Ölüm yemi sprite hattı (ağ üzerinden yükleme kanıtı, yüklenemezse düz yem) |
| `npm run verify:runlog` | Tur günlüğü regresyonu (ölüm ekranında sekme gizle/göster turu sıfırlamamalı; TEKRAR/MENÜ tek saymalı) |
| `npm run verify:seo` | Search Console sahiplik etiketi + başlık/açıklama + statik alt bilgi (gizlilik bağlantısı); kaynak ve `dist/` (build sonrası) |

`scripts/` altındaki `_*.mjs` dosyaları geliştirme sürecinde kullanılan dahili test/araç scriptleridir (npm script'i olarak bağlı değildir).

## Proje yapısı

```
src/
├─ core/       Oyun döngüsü, kamera, ana oyun sınıfı (Game, GameLoop, Camera)
├─ entities/   Snake, Bot, Food, Skin
├─ systems/    Hareket, çarpışma, render, ölüm efektleri, sprite derileri
├─ menu/       Ana menü, logo efektleri, arena seçimi, tur günlüğü, yerel depolama
├─ meta/       Market, sandık, kariyer, başarımlar, profil görünümleri
├─ auth/       Supabase istemcisi, oturum yönetimi, bulut kayıt
├─ privacy/    Gizlilik politikası sayfası (gizlilik.html girişi)
└─ utils/      Sabitler, ayarlar, FPS ölçümü, matematik yardımcıları
public/        Statik dosyalar (favicon, logo, ölüm yemi sprite'ları)
scripts/       Doğrulama (Playwright) ve varlık üretim scriptleri
```

Derleme çok sayfalıdır (`index.html` + `gizlilik.html`); kaynak haritası üretilmez ve her JS parçasının başına telif banner'ı eklenir (bkz. `vite.config.ts`).

## Ölüm yemi varlıkları

Ölüm yemi sprite'ları kaynak PNG'lerden üretilir:

```bash
node scripts/build-deathfood.mjs   # assets-src/death-food/*.png -> public/death-food/*.webp
```

Kırpma, ortalama, normalize ve defringe adımlarını uygular (128px kutu, WebP). İdempotenttir; Chromium gerektirir.

> Not: Orijinal tasarım dosyaları (`assets-src/` altındaki yüksek çözünürlüklü PNG kaynakları) bu depoda yer almaz; script yalnızca kaynak PNG'ler yerelde mevcutsa çalışır.

## Dağıtım (Vercel)

1. Repoyu Vercel'e import edin — Framework Preset: **Vite** (otomatik algılanır), Build: `npm run build`, Output: `dist`.
2. **Environment Variables:** `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` (Production + Preview).
3. Supabase → **Authentication → URL Configuration**: Site URL ve Redirect URLs'e dağıtım adresini ekleyin (`https://<proje>.vercel.app`) — aksi hâlde Google girişi geri dönmez.
4. `vercel.json`, tüm yanıtlara CSP ve `X-Content-Type-Options: nosniff` başlıklarını ekler.

> Not: Env değişkenleri eklenmese bile site açılır; yalnızca giriş ve bulut kayıt kapalı kalır.

## Güvenlik notları

- Repoda sır yoktur: `.env*` takip edilmez, yalnızca `.env.example` vardır.
- Anon anahtar istemciye gömülür (tasarım gereği); tek koruma Supabase **RLS**'tir. `service_role` anahtarı asla istemciye konmaz.
- Geliştirme kancaları (`__menu`, `__poll`, `render_game_to_text`, `advanceTime`) yalnızca DEV modunda tanımlıdır; üretim derlemesinde bulunmaz.
- `frame-ancestors` bilinçli olarak tanımlanmamıştır — oyunun iframe ile gömülebilmesi (oyun portalları) istenmiştir.

## Lisans

**Snakez.io Özel Lisansı** — © 2026 JAYNUS. Tüm hakları saklıdır.

Bu depodaki kaynak kodu ve görseller herkese açık olarak **görüntülenebilir**; ancak sahibin yazılı izni olmadan:

- kopyalanamaz, çoğaltılamaz, yeniden dağıtılamaz,
- değiştirilemez, uyarlanamaz, türev eser üretilemez,
- satılamaz, alt lisanslanamaz, kiraya verilemez,
- ticari amaçla kullanılamaz,
- telif bildirimleri kaldırılamaz veya değiştirilemez.

Oyunu sahibin sunduğu resmî site üzerinden **oynamak serbesttir.** Üçüncü taraf açık kaynak kütüphaneler ve fontlar kendi lisanslarına tabidir. Tam metin için [LICENSE](LICENSE) dosyasına bakın.

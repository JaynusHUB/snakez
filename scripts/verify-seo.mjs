/* SEO / SAHİPLİK KONTROLÜ — index.html ve dist/index.html
   ---------------------------------------------------------------------------
   Google Search Console sahiplik etiketi, başlık/açıklama, sosyal önizleme
   (og/twitter) etiketleri ve ana sayfadaki statik alt bilgi (gizlilik
   bağlantısı) kaynakta ve build çıktısında birebir mi? Metin kontrolü: ham
   HTML'de olması, JS ile üretilmediğinin kanıtıdır. Ayrıca README'lerdeki
   göreli görsellerin (docs/screenshots, public/...) diskte var olduğunu
   ve og.png / social-preview.png dosyalarını doğrular.
   dist yoksa "önce npm run build" der ve kırmızı yanar.
   Kullanım: npm run verify:seo  (build sonrası koşulur)                   */

import { readFileSync, existsSync } from 'node:fs';

const VERIFY = 'NnPxYTj5oVjnTJKT3v6spDOi8QTI-gZuFTqSBnw6YpQ';
const TITLE = 'Snakez.io – Yılan Arenası';
const DESC = 'Snakez.io: 30 rakipli tek kişilik yılan arena oyunu. Büyü, yakala, sıralamaya tırman; market, günlük sandık ve başarımlar.';
const FOOTER = 'Snakez.io — tek kişilik yılan arena oyunu';
const OG_URL = 'https://snakez-io.vercel.app';
const OG_IMG = 'https://snakez-io.vercel.app/og.png';

let fail = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) fail++;
};

const checkHtml = (label, html) => {
  const metas = html.match(/<meta[^>]*name="google-site-verification"[^>]*>/gi) || [];
  check(metas.length === 1, `${label}: google-site-verification meta tam 1 adet (${metas.length})`);
  check(metas.some((t) => t.includes(VERIFY)), `${label}: doğrulama içeriği birebir`);

  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
  check(title === TITLE, `${label}: <title> → "${title}"`);

  const desc = (html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i) || [])[1];
  check(desc === DESC, `${label}: <meta description> birebir`);

  // Sosyal önizleme: her etiket tam 1 adet ve içerik birebir.
  const og = [
    ['property', 'og:title', TITLE],
    ['property', 'og:description', DESC],
    ['property', 'og:type', 'website'],
    ['property', 'og:url', OG_URL],
    ['property', 'og:image', OG_IMG],
    ['name', 'twitter:card', 'summary_large_image'],
  ];
  for (const [attr, key, val] of og) {
    const tags = html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*>`, 'gi')) || [];
    check(tags.length === 1 && tags[0].includes(`content="${val}"`), `${label}: ${key} tam 1 adet ve birebir`);
  }

  check(html.includes(FOOTER), `${label}: alt bilgi metni ham HTML'de (JS'siz de görünür)`);
  check(
    /<a[^>]*href="\/gizlilik\.html"[^>]*>Gizlilik Politikası<\/a>/.test(html),
    `${label}: gizlilik bağlantısı /gizlilik.html`,
  );
  check(
    !/<a[^>]*href="\/gizlilik\.html"[^>]*target=/i.test(html),
    `${label}: gizlilik bağlantısı aynı sekmede (target yok)`,
  );
};

checkHtml('index.html', readFileSync(new URL('../index.html', import.meta.url), 'utf8'));

const dist = new URL('../dist/index.html', import.meta.url);
if (existsSync(dist)) {
  const distHtml = readFileSync(dist, 'utf8');
  checkHtml('dist/index.html', distHtml);
  check(/<link[^>]*rel="stylesheet"[^>]*>/i.test(distHtml), 'dist/index.html: stil bağlantısı var (JS olmadan da yüklenir)');
} else {
  check(false, 'dist/index.html yok — önce `npm run build` koşulmalı');
}

/* ── Sosyal önizleme dosyaları ────────────────────────────────────────── */
const rel = (p) => new URL(`../${p}`, import.meta.url);
for (const f of ['public/og.png', 'docs/social-preview.png', 'public/logo.webp']) {
  check(existsSync(rel(f)), `dosya var: ${f}`);
}

/* ── README görselleri: göreli yollar diskte bulunmalı ────────────────── */
for (const md of ['README.md', 'README.tr.md']) {
  if (!existsSync(rel(md))) { check(false, `${md} bulunamadı`); continue; }
  const txt = readFileSync(rel(md), 'utf8');
  const srcs = [...txt.matchAll(/<img[^>]*src="([^"]+)"/gi)].map((m) => m[1])
    .concat([...txt.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]))
    .filter((s) => !/^https?:/i.test(s));
  const missing = srcs.filter((s) => !existsSync(rel(s)));
  check(srcs.length >= 8, `${md}: göreli görsel ${srcs.length} adet (logo + 7 ekran görüntüsü)`);
  check(missing.length === 0, `${md}: kırık görsel bağlantısı yok${missing.length ? ' → ' + missing.join(', ') : ''}`);
}

console.log(fail === 0 ? '\nSEO KONTROLÜ: TAMAM (0 hata)' : `\nSEO KONTROLÜ: ${fail} HATA`);
process.exit(fail === 0 ? 0 : 1);

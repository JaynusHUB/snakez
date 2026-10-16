/* SEO / SAHİPLİK KONTROLÜ — index.html ve dist/index.html
   ---------------------------------------------------------------------------
   Google Search Console sahiplik etiketi, başlık/açıklama ve ana sayfadaki
   statik alt bilgi (gizlilik bağlantısı) kaynakta ve build çıktısında
   birebir mi? Metin kontrolü: ham HTML'de olması, JS ile üretilmediğinin
   kanıtıdır. dist yoksa "önce npm run build" der ve kırmızı yanar.
   Kullanım: npm run verify:seo  (build sonrası koşulur)                   */

import { readFileSync, existsSync } from 'node:fs';

const VERIFY = 'NnPxYTj5oVjnTJKT3v6spDOi8QTI-gZuFTqSBnw6YpQ';
const TITLE = 'Snakez.io – Yılan Arenası';
const DESC = 'Snakez.io: 30 rakipli tek kişilik yılan arena oyunu. Büyü, yakala, sıralamaya tırman; market, günlük sandık ve başarımlar.';
const FOOTER = 'Snakez.io — tek kişilik yılan arena oyunu';

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

console.log(fail === 0 ? '\nSEO KONTROLÜ: TAMAM (0 hata)' : `\nSEO KONTROLÜ: ${fail} HATA`);
process.exit(fail === 0 ? 0 : 1);

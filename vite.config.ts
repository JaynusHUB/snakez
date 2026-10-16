import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const BANNER =
  '/*! Snakez.io (c) 2026 JAYNUS. All rights reserved. Unauthorized copying, modification or distribution is prohibited. */';

// Telif başlığı: `/*!` minify sonrası da korunur. (Vite 8 altta Rolldown
// kullanır ve rollupOptions.output.banner'i uygulamaz; bu yüzden eklenti
// her JS parçasının başına yazar. Oyun koduna dokunmaz.)

// Çok sayfalı giriş: oyun (index.html) + Gizlilik Politikası (gizlilik.html).
// Gizlilik sayfası kendi TS girişinden beslenir (src/privacy/privacy.ts),
// böylece fontlar ve stiller bundle'a dahil olur, CSP'ye inline eklenmez.
export default defineConfig({
  plugins: [
    {
      name: 'snakez-license-banner',
      // Minify sonrasi: esbuild yasal yorumlari (`/*!` dahil) dusurur.
      // generateBundle dosya yazimindan hemen once calisir.
      generateBundle(_options, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk && typeof chunk === 'object' && 'code' in chunk && typeof chunk.fileName === 'string' && chunk.fileName.endsWith('.js')) {
            const c = chunk as { code: string };
            if (!c.code.startsWith('/*! Snakez.io')) c.code = `${BANNER}\n${c.code}`;
          }
        }
      },
    } satisfies Plugin,
  ],
  build: {
    // Üretim: kaynak haritası yok (kod gizliliği).
    sourcemap: false,
    rollupOptions: {
      input: {
        main: 'index.html',
        gizlilik: 'gizlilik.html',
      },
    },
  },
});

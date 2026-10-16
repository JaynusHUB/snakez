// Supabase istemcisi — tek örnek, tembel kurulum.
//
// Anahtarlar YOKSA client kurulmaz ve hata fırlatılmaz: oyun "yapılandırılmamış"
// kipte aynen çalışır, giriş düğmesi pasif görünür. Ağ hataları burada değil,
// çağıran tarafta (auth.ts) ele alınır.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

/** Yapılandırma mevcut ve görünüşte geçerliyse true. */
export function isAuthAvailable(): boolean {
  return url.length > 8 && url.startsWith('https://') && key.length > 20;
}

let client: SupabaseClient | null = null;

/** Yapılandırılmamışsa null döner (hata fırlatmaz). */
export function getClient(): SupabaseClient | null {
  if (!isAuthAvailable()) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      // Tüm istekler keepalive ile çıkar: sayfa kapanırken (pagehide)
      // başlatılan son flush'un gövdesi tarayıcı tarafından yine gönderilir.
      global: { fetch: (input, init) => fetch(input, { ...(init ?? {}), keepalive: true }) },
    });
  }
  return client;
}

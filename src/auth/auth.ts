// Kimlik doğrulama API'si — DOM yok, saf mantık. Oturum supabase-js'in kendi
// deposunda tutulur, sayfa yenilenince korunur. Veri OKUMA/YAZMA yok;
// bu aşamada yalnızca kimlik (sonraki aşamada bulut kayıt gelecek).
import { getClient } from './supabaseClient.ts';
import type { User } from '@supabase/supabase-js';

export { isAuthAvailable } from './supabaseClient.ts';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  /** Supabase auth.users kaydı (ISO). Üyelik satırı için; yoksa ''. */
  createdAt: string;
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT';

function text(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toUser(u: User): AuthUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = text(meta['full_name']) || text(meta['name']) || (u.email ? u.email.split('@')[0] : 'Oyuncu');
  return { id: u.id, email: u.email ?? '', name, avatar: text(meta['avatar_url']) || text(meta['picture']), createdAt: text(u.created_at) };
}

/** Mevcut oturumun kullanıcısı; yoksa veya ağ hatasında null. */
export async function getUser(): Promise<AuthUser | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { data, error } = await c.auth.getUser();
    if (error || !data.user) return null;
    return toUser(data.user);
  } catch {
    return null;
  }
}

export type Unsub = () => void;

/** Yalnızca gerçek geçişlerde çağrılır (ilk yüklemedeki sessiz oturumda değil). */
export function onAuthChange(cb: (ev: AuthEvent, user: AuthUser | null) => void): Unsub {
  const c = getClient();
  if (!c) return () => undefined;
  const { data } = c.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') cb('SIGNED_IN', session?.user ? toUser(session.user) : null);
    else if (event === 'SIGNED_OUT') cb('SIGNED_OUT', null);
  });
  return () => data.subscription.unsubscribe();
}

/** Google OAuth akışını başlatır (sayfa Supabase'e gidip geri döner).
 *  Yapılandırılmamışsa `AUTH_UNCONFIGURED` hatası fırlatır. */
export async function signInWithGoogle(): Promise<void> {
  const c = getClient();
  if (!c) throw new Error('AUTH_UNCONFIGURED');
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

/** Oturumu kapatır. Yapılandırılmamışsa sessizce döner. */
export async function signOut(): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.auth.signOut();
  } catch {
    /* çevrimdışı: yerel oturum zaten yok sayılır */
  }
}

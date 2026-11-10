import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Normalize Supabase URL to pure origin (strips accidental /rest/v1, /auth/v1, or trailing slashes)
const normalizeSupabaseUrl = (raw: string): string => {
  const clean = raw.trim().replace(/\/+$/, '');
  if (!clean || !clean.startsWith('http')) return clean;
  try {
    const parsed = new URL(clean);
    if (parsed.hostname.includes('supabase.co') || parsed.hostname.includes('supabase.in')) {
      return parsed.origin;
    }
  } catch {}
  return clean;
};

// Environment variables or custom user-configured credentials for Supabase
const getEnvUrl = () => {
  let url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  if ((!url || url.includes('placeholder')) && typeof localStorage !== 'undefined') {
    url = localStorage.getItem('ixtude_supabase_url') || '';
  }
  return normalizeSupabaseUrl(url);
};

const getEnvKey = () => {
  let key = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';
  if ((!key || key.includes('placeholder')) && typeof localStorage !== 'undefined') {
    key = localStorage.getItem('ixtude_supabase_anon_key') || '';
  }
  return key.trim();
};

export const getSupabaseConfig = () => {
  const url = getEnvUrl();
  const key = getEnvKey();
  return {
    url,
    hasKey: Boolean(key),
    isConfigured: Boolean(url && key && url.startsWith('http') && !url.includes('placeholder')),
  };
};

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfig().isConfigured;
};

export const saveCustomSupabaseConfig = (url: string, key: string): boolean => {
  if (typeof localStorage === 'undefined') return false;
  const cleanUrl = url.trim();
  const cleanKey = key.trim();
  if (!cleanUrl.startsWith('http')) return false;
  if (!cleanKey) return false;

  localStorage.setItem('ixtude_supabase_url', cleanUrl);
  localStorage.setItem('ixtude_supabase_anon_key', cleanKey);
  return true;
};

export const clearCustomSupabaseConfig = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('ixtude_supabase_url');
    localStorage.removeItem('ixtude_supabase_anon_key');
  }
};

const initClient = (): SupabaseClient | null => {
  const { url, hasKey, isConfigured } = getSupabaseConfig();
  const key = getEnvKey();
  if (isConfigured && hasKey && url) {
    try {
      return createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch {
      return null;
    }
  }
  return null;
};

// Singleton client instance (null when not configured, triggers graceful local fallback)
export const supabase: SupabaseClient | null = initClient();

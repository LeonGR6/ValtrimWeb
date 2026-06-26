import { createClient } from '@supabase/supabase-js';

const normalizeConfigValue = (rawValue) => {
  const value = String(rawValue ?? '').trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).trim();
  }
  return value;
};

export const SUPABASE_URL = normalizeConfigValue(import.meta.env.VITE_SUPABASE_URL);
export const SUPABASE_ANON_KEY = normalizeConfigValue(import.meta.env.VITE_SUPABASE_ANON_KEY);
export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })
  : null;

export function assertSupabaseConfig() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  return supabase;
}

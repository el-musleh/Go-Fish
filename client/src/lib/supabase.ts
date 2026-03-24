import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Fall back to in-memory storage if localStorage is blocked (private mode, etc.)
function makeStorage() {
  try {
    localStorage.setItem('__sb_test__', '1');
    localStorage.removeItem('__sb_test__');
    return localStorage;
  } catch {
    const mem: Record<string, string> = {};
    return {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v; },
      removeItem: (k: string) => { delete mem[k]; },
    };
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: makeStorage() },
});

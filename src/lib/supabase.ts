// =============================================================================
// SUPABASE CLIENT (FRONTEND)
//
// Golden Rules:
// 1. Initialized strictly with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// 2. The service role key is NEVER exposed to or used by the browser.
// 3. Includes fallback check so developers get clear guidance if env vars are missing.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
// Normalize URL in case user provides full REST endpoint (e.g. https://xyz.supabase.co/rest/v1/)
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = () => {
  return (
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_ANON_KEY !== 'placeholder-anon-key'
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

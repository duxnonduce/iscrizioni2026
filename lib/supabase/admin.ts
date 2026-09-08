import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Usa la Service Role Key: bypassa la RLS. Va usato SOLO in codice server-side
// (server actions), mai esposto al browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

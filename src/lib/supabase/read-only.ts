import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server Component から公開データ（areas/hotels/active deals）だけを
 * 読み取るためのクライアント。anon keyを使い、RLSの読み取り専用ポリシーに従う。
 */
export function createReadOnlySupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

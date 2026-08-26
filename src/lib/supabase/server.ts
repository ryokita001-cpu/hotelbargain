import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * service_role key を使う特権クライアント。
 * RLSを無視して書き込むため、Cron/バッチ処理からのみ使用する。
 * ブラウザに公開してはいけない。
 */
export function createServiceRoleSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Supabaseプロジェクト設定 > API から取得して .env.local に設定してください。",
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );
}
